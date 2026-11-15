(() => {
  const load = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Не загрузился ${src}`));
    document.body.append(script);
  });
  load('./account.js?v=15')
    .then(() => load('./workshop.js?v=15'))
    .then(() => load('./app.js?v=15'))
    .catch((error) => console.error('Не удалось запустить мастерскую', error));
})();
