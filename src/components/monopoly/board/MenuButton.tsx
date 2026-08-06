import { useNavigate } from 'react-router-dom';
import { connect } from 'react-redux';
import style from '../../../assets/css/board.module.scss';
import { setShowModal } from '../../../redux/actions/modal';

const MenuButton = ({ setShowModal }: any) => {
  const navigate = useNavigate();

  const onLeave = () => {
    if (window.confirm('Leave the table and return to the lobby?')) {
      navigate('/');
    }
  };

  const onOpenLog = () => {
    setShowModal(true, 'ACTION_LOG');
  };

  return (
    <div className={style.topBarButtonGroup}>
      <button
        className={style.menuIconButton}
        onClick={onLeave}
        title="Leave table"
        aria-label="Leave Table"
      >
        🚪 Leave
      </button>
      <button
        className={style.logIconButton}
        onClick={onOpenLog}
        title="Game Action Log"
        aria-label="Action Log"
      >
        📜 Log
      </button>
    </div>
  );
};

const mapDispatchToProps = (dispatch: any) => ({
  setShowModal: (show: boolean, modal: string) => dispatch(setShowModal(show, modal)),
});

export default connect(null, mapDispatchToProps)(MenuButton);
