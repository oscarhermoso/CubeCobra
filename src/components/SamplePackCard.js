import React, { useContext, useState, useCallback } from 'react';

import CubeContext from 'contexts/CubeContext';
import LabelRow from 'components/LabelRow';

import { Card, CardBody, CardHeader, CardTitle, Input, CardFooter, Button } from 'reactstrap';

const SamplePackCard = (props) => {
  const { cubeID } = useContext(CubeContext);
  const [seed, setSeed] = useState('');
  const handleChange = useCallback((event) => setSeed(event.target.value), []);

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle tag="h5" className="mb-0">
          View sample pack
        </CardTitle>
      </CardHeader>
      <CardBody>
        <LabelRow htmlFor="seed" label="Seed" className="mb-0">
          <Input type="text" name="seed" id="seed" value={seed} onChange={handleChange} />
        </LabelRow>
      </CardBody>
      <CardFooter>
        <Button color="success" className="me-2" href={`/cube/samplepack/${cubeID}`}>
          View Random
        </Button>
        <Button color="success" disabled={!seed} href={`/cube/samplepack/${cubeID}/${seed}`}>
          View Seeded
        </Button>
      </CardFooter>
    </Card>
  );
};

export default SamplePackCard;