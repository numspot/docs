import React, {useEffect, useRef, useState, type ReactNode} from 'react';
import Translate from '@docusaurus/Translate';
import {translate} from '@docusaurus/Translate';

// One row per query-language feature: the literal syntax stays untranslated
// (it is the syntax itself), the meaning is translated via code.json
// (i18n/fr/code.json). Prefix (+word, -word) and keyword (AND, OR, NOT)
// forms are listed separately — they read differently and their meaning
// differs (+word requires ONE word, AND requires both neighbors). Keep this
// list in sync with SEARCH.md.
const SYNTAX_ROWS: ReadonlyArray<readonly [string, string, string]> = [
  ['+word', 'theme.search.syntax.required', 'required, exact word'],
  ['a AND b', 'theme.search.syntax.and', 'both words required'],
  ['a OR b', 'theme.search.syntax.or', 'either alternative'],
  ['-word', 'theme.search.syntax.excluded', 'excludes matching documents'],
  ['NOT word', 'theme.search.syntax.not', 'same as -word'],
  ['"quoted words"', 'theme.search.syntax.phrase', 'every word required and exact'],
  ['prefix*', 'theme.search.syntax.prefix', 'any word starting with…'],
  ['word~2', 'theme.search.syntax.fuzzy', 'allows up to 2 typos'],
  ['title:word', 'theme.search.syntax.fieldTitle', 'search in page titles only'],
];

/**
 * "?" help button opening a popover that documents the search query
 * language. Shared by the navbar SearchBar swizzle (src/theme/SearchBar)
 * and the /search results page, next to their respective inputs. Hover
 * opens it like a tooltip; click pins it (touch and keyboard); Escape or an
 * outside click closes it. Strings are localized through code.json
 * (theme.search.syntax.*) — see SEARCH.md for the maintainer-facing grammar.
 */
export default function SearchSyntaxHelp(): ReactNode {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const open = hovered || pinned;

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    // Clicking anywhere else unpins and closes; Escape closes too. The
    // popover must not trap the focus flow of the search input itself.
    const onPointerDown = (event: PointerEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setPinned(false);
        setHovered(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setPinned(false);
        setHovered(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span
      className="search-syntax"
      ref={rootRef}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <button
        type="button"
        className="search-syntax__toggle"
        aria-expanded={open}
        aria-label={translate({
          id: 'theme.search.syntax.toggleLabel',
          message: 'Search syntax help',
          description: 'Accessible name of the button opening the search syntax popover',
        })}
        onClick={() => setPinned((value) => !value)}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" focusable="false">
          <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="10" cy="6.3" r="1.1" fill="currentColor" />
          <rect x="9.1" y="8.9" width="1.8" height="5.6" rx="0.9" fill="currentColor" />
        </svg>
      </button>
      {open && (
        <div className="search-syntax__popover">
          <p className="search-syntax__title">
            <Translate
              id="theme.search.syntax.popoverTitle"
              description="Title of the search syntax popover"
            >
              Search syntax
            </Translate>
          </p>
          <ul className="search-syntax__list">
            {SYNTAX_ROWS.map(([syntax, messageId, message]) => (
              <li key={messageId}>
                <code>{syntax}</code> —{' '}
                {translate({
                  id: messageId,
                  message,
                  description: 'One row of the search syntax popover',
                })}
              </li>
            ))}
          </ul>
          <p className="search-syntax__footnote">
            <Translate
              id="theme.search.syntax.footnote"
              description="Footnote of the search syntax popover: accents and example"
            >
              Accents are ignored. Example: registry AND password -deprecated
            </Translate>
          </p>
        </div>
      )}
    </span>
  );
}
