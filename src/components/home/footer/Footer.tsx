import style from '../../../assets/css/home/footer.module.scss';
const Footer = () => {
  return (
    <div className={`${style.footerContainer} parentContainer`}>
      <div className={`${style.footer} container`}>
        <p className={style.copyright}>Heavy Business — a free, real-time property trading game</p>
      </div>
    </div>
  );
};

export default Footer;
