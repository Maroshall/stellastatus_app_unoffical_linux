// ── 문의하기(이메일 · GitHub 이슈) ─────────────
function wireContact() {
  const CONTACT = {
    email: 'mailto:ryoyamada8083@proton.me?subject=' + encodeURIComponent('[스텔라상태] 문의'),
    github: 'https://github.com/Maroshall/stellastatus_app_unoffical_linux/issues/new',
  };

  // 기존 HTML에 X 문의 항목이 남아 있으면 제거
  const xContact = document.querySelector('.contact-opt[data-contact="x"]');
  if (xContact) xContact.remove();

  $('#btnContact').addEventListener('click', () => openModalEl('#contactModal'));
  $('#closeContact').addEventListener('click', () => closeModalEl('#contactModal'));
  $('#contactModal').addEventListener('click', (e) => {
    if (e.target.id === 'contactModal') closeModalEl('#contactModal');
  });

  document.querySelectorAll('.contact-opt').forEach((b) =>
    b.addEventListener('click', () => {
      const url = CONTACT[b.dataset.contact];
      if (url) openLink(url);
      closeModalEl('#contactModal');
    }),
  );
}
