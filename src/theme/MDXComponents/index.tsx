import React, {type ComponentProps} from 'react';
import MDXComponents from '@theme-original/MDXComponents';
import LastUpdatedDate from '@site/src/components/LastUpdatedDate';

/**
 * Adds the review date right under the markdown H1 of every doc page (except
 * the homepage, see LastUpdatedDate). The date is rendered inside the
 * <header> wrapper that Docusaurus wraps around the first content heading.
 */
export default {
  ...MDXComponents,
  h1: (props: ComponentProps<'h1'>) => (
    <>
      {/* Original h1 rendering (theme Heading with anchor) */}
      {React.createElement(MDXComponents.h1, props)}
      <LastUpdatedDate />
    </>
  ),
};
