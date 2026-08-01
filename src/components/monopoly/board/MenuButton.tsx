import { useNavigate } from 'react-router-dom';
import style from '../../../assets/css/board.module.scss';

const MenuButton = () => {
  const navigate = useNavigate();

  const onClick = () => {
    if (window.confirm('Leave the table and return to the lobby?')) {
      navigate('/');
    }
  };

  return (
    <button className={style.menuIconButton} onClick={onClick} title="Leave table" aria-label="Menu">
      📋
    </button>
  );
};

export default MenuButton;
