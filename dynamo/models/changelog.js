// dotenv
require('dotenv').config();

const uuid = require('uuid/v4');
const createClient = require('../util');
const s3 = require('../s3client');
const carddb = require('../../serverjs/cards');
const cardutil = require('../../dist/utils/Card');

const FIELDS = {
  CUBE_ID: 'CubeId',
  DATE: 'Date',
  ID: 'Id',
};

const client = createClient({
  name: 'CUBE_CHANGELOG',
  partitionKey: FIELDS.CUBE_ID,
  sortKey: FIELDS.DATE,
  attributes: {
    [FIELDS.CUBE_ID]: 'S',
    [FIELDS.DATE]: 'N',
  },
  FIELDS,
});

const BLOG_HTML_PARSE = />([^</]+)<\//g;
const MAX_CACHE_SIZE = 10000;

// LRU cache for changelog
const changelogCache = {};

const evictOldest = () => {
  const oldest = Object.entries(changelogCache).sort(([, valuea], [, valueb]) =>
    valuea.date.localeCompare(valueb.date),
  );
  delete changelogCache[oldest[0][0]];
};

const getChangelog = async (id) => {
  if (changelogCache[id]) {
    return changelogCache[id].document;
  }

  const res = await s3
    .getObject({
      Bucket: process.env.DATA_BUCKET,
      Key: `changelog/cubeId/${id}.json`,
    })
    .promise();
  const changelog = JSON.parse(res.Body.toString());

  if (Object.keys(changelogCache).length >= MAX_CACHE_SIZE) {
    evictOldest();
  }

  changelogCache[id] = {
    date: new Date(),
    document: changelog,
  };

  return changelog;
};

const parseHtml = (html) => {
  const changelog = {
    Mainboard: {},
  };

  const items = html.split(/<\/?br\/?>/g);
  for (const item of items) {
    const tokens = [...item.matchAll(BLOG_HTML_PARSE)].map(([, token]) => token);
    if (tokens.length === 2) {
      const [operator, cardname] = tokens;
      const name = cardutil.normalizeName(cardname);
      const ids = carddb.nameToId[name];

      if (operator === '+') {
        if (!changelog.Mainboard.adds) {
          changelog.Mainboard.adds = [];
        }
        if (ids) {
          changelog.Mainboard.adds.push(ids[0]);
        }
      } else if (operator === '-' || operator === '–') {
        if (!changelog.Mainboard.removes) {
          changelog.Mainboard.removes = [];
        }
        if (ids) {
          changelog.Mainboard.removes.push({ oldCard: ids[0] });
        }
      }
    } else if (tokens.length === 3) {
      const [operator, removed, added] = tokens;
      if (operator === '→') {
        if (!changelog.Mainboard.swaps) {
          changelog.Mainboard.swaps = [];
        }

        const addedIds = carddb.nameToId[cardutil.normalizeName(added)];
        const removedIds = carddb.nameToId[cardutil.normalizeName(removed)];

        if (addedIds && removedIds) {
          changelog.Mainboard.swaps.push({
            oldCard: addedIds[0],
            card: removedIds[0],
          });
        }
      }
    }
  }

  return changelog;
};

module.exports = {
  getById: getChangelog,
  getByCubeId: async (cubeId, lastKey) => {
    const result = await client.query({
      KeyConditionExpression: `#p1 = :cubeId`,
      ExpressionAttributeValues: {
        ':cubeId': cubeId,
      },
      ExpressionAttributeNames: {
        '#p1': FIELDS.CUBE_ID,
      },
      ExclusiveStartKey: lastKey,
      ScanIndexForward: false,
    });

    const items = await Promise.all(result.Items.map((item) => getChangelog(item[FIELDS.ID])));

    return {
      items,
      lastEvaluatedKey: result.LastEvaluatedKey,
    };
  },
  put: async (changelog, cubeId) => {
    const id = uuid();
    await s3
      .putObject({
        Bucket: process.env.DATA_BUCKET,
        Key: `changelog/${cubeId}/${id}.json`,
        Body: JSON.stringify(changelog),
      })
      .promise();
    await client.put({
      Item: {
        [FIELDS.ID]: id,
        [FIELDS.CUBE_ID]: cubeId,
        [FIELDS.DATE]: Date.now().valueOf(),
      },
    });
  },
  batchPut: async (documents) => {
    await client.batchPut(
      documents.map((document) => ({
        [FIELDS.ID]: document.id,
        [FIELDS.CUBE_ID]: document.cubeId,
        [FIELDS.DATE]: document.date || Date.now().valueOf(),
      })),
    );
    await Promise.all(
      documents.map(async (document) =>
        s3
          .putObject({
            Bucket: process.env.DATA_BUCKET,
            Key: `changelog/${document.cubeId}/${document.id}.json`,
            Body: JSON.stringify(document.changelog),
          })
          .promise(),
      ),
    );
  },
  createTable: async () => client.createTable(),
  getChangelogFromBlog: (blog) => {
    const { cube, date } = blog;

    let changelog = null;
    if (blog.changed_cards) {
      changelog = {
        Mainboard: {},
      };
      for (const { removed, added } of blog.changed_cards) {
        if (added && removed) {
          // swap
          if (!changelog.Mainboard.swaps) {
            changelog.Mainboard.swaps = [];
          }
          changelog.Mainboard.swaps.push({
            card: added,
            oldCard: removed,
          });
        } else if (added) {
          // add
          if (!changelog.Mainboard.adds) {
            changelog.Mainboard.adds = [];
          }
          changelog.Mainboard.adds.push(added);
        } else if (removed) {
          // remove
          if (!changelog.Mainboard.removes) {
            changelog.Mainboard.removes = [];
          }
          changelog.Mainboard.removes.push({
            oldCard: removed,
          });
        }
      }
    } else if (blog.changelist) {
      changelog = parseHtml(blog.changelist);
    } else if (blog.html && blog.html.includes('span')) {
      changelog = parseHtml(blog.html);
    }

    if (!changelog || Object.entries(changelog.Mainboard).length === 0) {
      return [];
    }

    return [
      {
        id: `${blog._id}`,
        cubeId: `${cube}`,
        changelog,
        date: date.valueOf() || Date.now().valueOf(),
      },
    ];
  },
  FIELDS,
};
