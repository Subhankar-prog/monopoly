import style from '../../../assets/css/home/header.module.scss';
import logo from '../../../assets/images/logo.svg';
const Header = () => {
  return (
    <header className={`${style.header} parentContainer`}>
      <div className={`${style.headerInner} container`}>
        <div className={style.logo}>
          <a href="/">
            <img src={logo} alt="Heavy Business" />
          </a>
        </div>
        <a href="/lobby" className={style.navCta}>
          Play Now
        </a>
      </div>
    </header>
  );
};

export default Header;
