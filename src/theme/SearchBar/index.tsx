import React, {type ReactNode} from 'react';
import SearchBar from '@theme-original/SearchBar';
import type SearchBarType from '@theme/SearchBar';
import type {WrapperProps} from '@docusaurus/types';
import SearchSyntaxHelp from '@site/src/components/SearchSyntaxHelp';

type Props = WrapperProps<typeof SearchBarType>;

/**
 * Wrapper of the search plugin's navbar SearchBar (D-023): adds the shared
 * syntax-help button (src/components/SearchSyntaxHelp) next to the field.
 * The plugin keeps rendering unchanged; this wrapper only puts the two
 * controls on one line and anchors the popover (position: relative comes
 * from .navbar__searchWithSyntax in src/css/components/search.css).
 */
export default function SearchBarWrapper(props: Props): ReactNode {
  return (
    <div className="navbar__searchWithSyntax">
      <SearchBar {...props} />
      <SearchSyntaxHelp />
    </div>
  );
}
