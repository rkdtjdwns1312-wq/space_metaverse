const PAGE_SIZE = 20;
const PAGE_COUNT = 2;

/**
 * Creates the two-page inventory navigator without owning inventory rendering.
 * The current page intentionally survives calls to slice(), so roster updates
 * can refresh the visible rows without moving the player back to page one.
 */
export function createInventoryPages({ onChange } = {}) {
  const list = document.querySelector('#bag-list');
  if (!list) throw new Error('Inventory pages require #bag-list.');

  let page = 1;
  const nav = document.createElement('nav');
  nav.className = 'inventory-pages';
  nav.setAttribute('aria-label', '가방 페이지');
  nav.setAttribute('role', 'tablist');

  const buttons = [1, 2].map((number) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'inventory-page-tab';
    button.textContent = String(number);
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', 'bag-list');
    button.addEventListener('click', () => setPage(number));
    button.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        setPage(page + 1);
        buttons[page - 1].focus();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        setPage(page - 1);
        buttons[page - 1].focus();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        setPage(event.key === 'Home' ? 1 : PAGE_COUNT);
        buttons[page - 1].focus();
      }
    });
    nav.append(button);
    return button;
  });

  // 페이지 선택은 가방 제목 바로 아래에 고정합니다.
  const title = document.querySelector('#inventory-title');
  if (title) title.after(nav);
  else list.before(nav);

  function updateTabs() {
    buttons.forEach((button, index) => {
      const selected = index + 1 === page;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
  }

  function setPage(nextPage) {
    const next = Math.max(1, Math.min(PAGE_COUNT, Math.floor(Number(nextPage)) || 1));
    page = next;
    updateTabs();
    onChange?.();
  }

  updateTabs();

  return {
    slice(rows) {
      const source = Array.isArray(rows) ? rows : [];
      const start = (page - 1) * PAGE_SIZE;
      return source.slice(start, start + PAGE_SIZE);
    },
    reset() {
      page = 1;
      updateTabs();
    },
    setPage,
  };
}

export const INVENTORY_PAGE_SIZE = PAGE_SIZE;
export const INVENTORY_PAGE_COUNT = PAGE_COUNT;
