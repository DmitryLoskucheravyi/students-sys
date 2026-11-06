// Виконується до першого малювання, щоб темна тема не блимала білим.
(function () {
  var saved = null;
  try { saved = localStorage.getItem('zoshyt-theme'); } catch (e) {}
  var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
