/**
 * Shared panel UI primitives.
 *
 * These encode one visual language — bordered surfaces on
 * --color-background-secondary, inset elements on --color-background, usage
 * readouts with progress bars, icon+text metadata chips — so pages stop
 * hand-rolling inline styles and stay consistent with each other.
 */
export { default as Panel, PanelHeader, PanelBody, PanelList } from './Panel';
export type { PanelHeaderProps } from './Panel';

export { default as StatTile } from './StatTile';
export type { StatTileProps } from './StatTile';

export { default as StatDetails } from './StatDetails';
export type { StatDetailsProps, StatDetailRow } from './StatDetails';

export { default as AnimatedNumber } from './AnimatedNumber';
export type { AnimatedNumberProps } from './AnimatedNumber';

export { VALUE_TRANSITION_MS, EASE_OUT_CUBIC, easeOutCubic, tweenValue, prefersReducedMotion } from './motion';

export { default as MetaChip } from './MetaChip';
export type { MetaChipProps, ChipTone } from './MetaChip';

export { default as DataField } from './DataField';
export type { DataFieldProps } from './DataField';

export { default as PageHeader } from './PageHeader';
export type { PageHeaderProps } from './PageHeader';

export { stateColors, usageLevel, usageColor, usageTextColor, percentOf, UNLIMITED } from './tokens';
export type { UsageLevel } from './tokens';
