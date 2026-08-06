import style from '../../../assets/css/home/footer.module.scss';

const Footer = () => {
  return (
    <footer className={`${style.footerContainer} parentContainer`}>
      <div className="sambalpuriIkatRibbon" />
      <div className={`${style.footerInner} container`}>
        <div className={style.brandCol}>
          <span className={style.brandTitle}>🪔 Heavy Business</span>
          <span className={style.editionBadge}>Heritage Edition</span>
        </div>

        <div className={style.creditCol}>
          <span>Made with <span className={style.heart}>❤️</span> by <strong>Subhankar</strong></span>
        </div>

        <div className={style.contactCol}>
          <a href="tel:6372466462" className={style.contactLink} title="Call Technical Support">
            <span className={style.phoneIcon}>📞</span>
            <span>For technical errors, contact: <strong>6372466462</strong></span>
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
