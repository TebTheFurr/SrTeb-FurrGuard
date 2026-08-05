import tw from 'twin.macro';
import { createGlobalStyle } from 'styled-components/macro';
// @ts-expect-error untyped font file
import font from '@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2';

export default createGlobalStyle`
    @font-face {
        font-family: 'IBM Plex Sans';
        font-style: normal;
        font-display: swap;
        font-weight: 100 700;
        src: url(${font}) format('woff2-variations');
        unicode-range: U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;
    }

    * {
        box-sizing: border-box;
    }

    html {
        background-color: var(--color-background) !important;
    }

    body {
        ${tw`font-sans`};
        background-color: var(--color-background) !important;
        color: var(--color-base) !important;
        letter-spacing: 0.015em;
        min-height: 100vh;
    }

    #app {
        min-height: 100vh;
        background-color: var(--color-background);
    }

    h1, h2, h3, h4, h5, h6 {
        ${tw`font-medium tracking-normal font-header`};
        color: var(--color-base);
    }

    p {
        ${tw`leading-snug font-sans`};
        color: var(--color-muted);
    }

    form {
        ${tw`m-0`};
    }

    textarea, select, input, button, button:focus, button:focus-visible {
        ${tw`outline-none`};
    }

    input[type=number]::-webkit-outer-spin-button,
    input[type=number]::-webkit-inner-spin-button {
        -webkit-appearance: none !important;
        margin: 0;
    }

    input[type=number] {
        -moz-appearance: textfield !important;
    }

    a {
        color: var(--color-primary);
        transition: color 100ms ease;
    }

    a:hover {
        color: var(--color-secondary);
    }

    ::selection {
        background-color: var(--color-primary);
        color: var(--color-base);
    }

    ::-webkit-scrollbar {
        background: var(--color-background);
        width: 10px;
        height: 10px;
    }

    ::-webkit-scrollbar-thumb {
        background: var(--color-background-secondary);
        border: 2px solid var(--color-background);
        border-radius: 8px;
    }

    ::-webkit-scrollbar-thumb:hover {
        background: var(--color-neutral);
    }

    ::-webkit-scrollbar-track {
        background: transparent;
    }

    ::-webkit-scrollbar-corner {
        background: transparent;
    }

    .fade-appear,
    .fade-enter {
        opacity: 0;
        transform: translateY(8px);
    }

    .fade-appear-active,
    .fade-enter-active {
        opacity: 1;
        transform: translateY(0);
        transition: opacity 100ms ease, transform 100ms ease;
    }

    .fade-exit {
        opacity: 1;
    }

    .fade-exit-active {
        opacity: 0;
        transition: opacity 100ms ease;
    }

    [class*="bg-neutral-900"],
    [class*="bg-neutral-800"] {
        background-color: var(--color-background) !important;
    }

    [class*="bg-neutral-700"],
    [class*="bg-neutral-600"] {
        background-color: var(--color-background-secondary) !important;
    }

    [class*="bg-neutral-500"] {
        background-color: var(--color-neutral) !important;
    }

    [class*="text-neutral-100"],
    [class*="text-neutral-50"] {
        color: var(--color-base) !important;
    }

    [class*="text-neutral-200"],
    [class*="text-neutral-300"] {
        color: var(--color-muted) !important;
    }

    [class*="text-neutral-400"],
    [class*="text-neutral-500"],
    [class*="text-neutral-600"] {
        color: var(--color-inverted) !important;
    }

    [class*="border-neutral"] {
        border-color: var(--color-neutral) !important;
    }

    [class*="bg-primary-500"] {
        background-color: var(--color-primary) !important;
    }

    [class*="bg-primary-600"] {
        background-color: var(--color-secondary) !important;
    }

    [class*="text-primary"] {
        color: var(--color-primary) !important;
    }

    [class*="border-primary"] {
        border-color: var(--color-primary) !important;
    }

    [class*="bg-cyan"] {
        background-color: var(--color-primary) !important;
    }

    [class*="text-cyan"] {
        color: var(--color-primary) !important;
    }

    [class*="border-cyan"] {
        border-color: var(--color-primary) !important;
    }

    [class*="ring-cyan"] {
        --tw-ring-color: var(--color-primary) !important;
    }

    [class*="ring-primary"] {
        --tw-ring-color: var(--color-primary) !important;
    }

    /* CodeMirror theme overrides */
    .CodeMirror,
    .cm-s-ayu-mirage.CodeMirror {
        background-color: var(--color-background-secondary) !important;
        border-radius: var(--border-radius, 8px) !important;
    }

    .cm-s-ayu-mirage .CodeMirror-gutters {
        background-color: var(--color-background-secondary) !important;
        border-right: 1px solid var(--color-neutral) !important;
    }

    .cm-s-ayu-mirage .CodeMirror-guttermarker,
    .cm-s-ayu-mirage .CodeMirror-guttermarker-subtle,
    .cm-s-ayu-mirage .CodeMirror-linenumber {
        color: var(--color-inverted) !important;
    }

    .cm-s-ayu-mirage .CodeMirror-cursor {
        border-left-color: var(--color-base) !important;
    }

    .cm-s-ayu-mirage .CodeMirror-activeline-background {
        background-color: var(--color-background) !important;
    }

    .cm-s-ayu-mirage .CodeMirror-selected,
    .cm-s-ayu-mirage .CodeMirror-focused .CodeMirror-selected {
        background-color: var(--color-neutral) !important;
    }

    .CodeMirror-dialog {
        background-color: var(--color-background-secondary) !important;
        border-color: var(--color-neutral) !important;
        color: var(--color-base) !important;
    }

    .CodeMirror-dialog input {
        background-color: var(--color-background) !important;
        border-color: var(--color-neutral) !important;
        color: var(--color-base) !important;
    }
`;
