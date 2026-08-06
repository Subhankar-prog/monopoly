import style from '../../../assets/css/home/header.module.scss';
import customLogo from '../../../assets/images/custom-logo.jpg';
const Header = () => {
  return (
    <header className={`${style.header} parentContainer`}>
      <div className="sambalpuriIkatRibbon" />
      <div className={`${style.headerInner} container`}>
        <div className={style.logo}>
          <a href="/">
            <img src={customLogo} alt="Heavy Business Logo" className={style.headerLogoImg} />
          </a>
        </div>
        {/* <a href="/lobby" className={style.navCta}>
          Play Now
        </a> */}
      </div>
      <div className="sambalpuriIkatRibbon" />
    </header>
  );
};

export default Header;
