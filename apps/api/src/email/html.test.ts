import { expect, test } from 'vitest';

import { html } from './html.ts';

test('escapes every interpolated string', () => {
  const name = `<script>alert("x")</script> & 'co'`;

  expect(html`<p>${name}</p>`.safeHtml).toBe(
    '<p>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;co&#39;</p>',
  );
});

test('an interpolated attribute cannot close its quotes', () => {
  const url = 'https://app.test/"><img src=x onerror=alert(1)>';

  expect(html`<a href="${url}">ok</a>`.safeHtml).toBe(
    '<a href="https://app.test/&quot;&gt;&lt;img src=x onerror=alert(1)&gt;">ok</a>',
  );
});

test('keeps markup built by html itself, alone or in a list', () => {
  const paragraphs = ['a < b', 'c'].map((text) => html`<p>${text}</p>`);

  expect(html`<div>${paragraphs}${html`<hr />`}</div>`.safeHtml).toBe(
    '<div><p>a &lt; b</p><p>c</p><hr /></div>',
  );
});
