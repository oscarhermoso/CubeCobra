import React, { useCallback, useMemo } from 'react';
import cx from 'classnames';
import PropTypes from 'prop-types';
import CardPropType from 'proptypes/CardPropType';
import { getCardColorClass } from 'utils/Util';

import withAutocard from 'components/WithAutocard';

const AutocardDiv = withAutocard('li');

const CARD_NAME_FALLBACK = 'Unidentified Card';
const CARD_ID_FALLBACK = 'undefined';

const noOp = () => undefined;

const styles = {
  root: 'card-list-item list-group-item',
  name: 'card-list-item_name',
  children: 'card-list-item_children',
};

const AutocardListItem = ({ card, noCardModal, inModal, className, children, ...props }) => {
  const [cardName, cardId] = useMemo(
    () => (card && card.details ? [card.details.name, card.details._id] : [CARD_NAME_FALLBACK, CARD_ID_FALLBACK]),
    [card],
  );

  const openCardToolWindow = useCallback(() => {
    window.open(`/tool/card/${cardId}`);
  }, [cardId]);

  const handleAuxClick = useCallback(
    (event) => {
      if (event.button === 1) {
        event.preventDefault();
        openCardToolWindow();
      }
    },
    [openCardToolWindow],
  );

  const colorClassname = useMemo(() => getCardColorClass(card), [card]);

  return (
    <AutocardDiv
      className={cx(styles.root, colorClassname, className)}
      card={card}
      onAuxClick={noCardModal ? noOp : handleAuxClick}
      inModal={inModal}
      role="button"
      {...props}
    >
      <span className={styles.children}>{children}</span>
      <span className={styles.name}>{cardName}</span>
    </AutocardDiv>
  );
};
AutocardListItem.propTypes = {
  card: CardPropType.isRequired,
  noCardModal: PropTypes.bool,
  inModal: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
};
AutocardListItem.defaultProps = {
  noCardModal: false,
  inModal: false,
  className: '',
  children: undefined,
};

export default AutocardListItem;
