// Виконується до першого малювання, щоб темна тема не блимала білим.
(function () {
  var saved = null;
  try { saved = localStorage.getItem('zoshyt-theme'); } catch (e) {}
  var dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  // Сайт школи завжди світлий (червоно-біла айдентика); тема діє лише в кабінеті й на тестах за посиланням.
  var path = location.pathname;
  if (!(path === '/cabinet' || path.indexOf('/cabinet/') === 0 || path.indexOf('/q/') === 0)) dark = false;
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
