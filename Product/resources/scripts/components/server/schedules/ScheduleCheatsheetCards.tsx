import React from 'react';
import tw from 'twin.macro';

export default () => {
    return (
        <>
            <div css={tw`md:w-1/2 h-full`} style={{ backgroundColor: 'var(--color-background-secondary)' }}>
                <div css={tw`flex flex-col`}>
                    <h2 css={tw`py-4 px-6 font-bold`} style={{ color: 'var(--color-base)' }}>Examples</h2>
                    <div css={tw`flex py-4 px-6`} style={{ backgroundColor: 'var(--color-neutral)' }}>
                        <div css={tw`w-1/2`} style={{ color: 'var(--color-base)' }}>*/5 * * * *</div>
                        <div css={tw`w-1/2`} style={{ color: 'var(--color-muted)' }}>every 5 minutes</div>
                    </div>
                    <div css={tw`flex py-4 px-6`}>
                        <div css={tw`w-1/2`} style={{ color: 'var(--color-base)' }}>0 */1 * * *</div>
                        <div css={tw`w-1/2`} style={{ color: 'var(--color-muted)' }}>every hour</div>
                    </div>
                    <div css={tw`flex py-4 px-6`} style={{ backgroundColor: 'var(--color-neutral)' }}>
                        <div css={tw`w-1/2`} style={{ color: 'var(--color-base)' }}>0 8-12 * * *</div>
                        <div css={tw`w-1/2`} style={{ color: 'var(--color-muted)' }}>hour range</div>
                    </div>
                    <div css={tw`flex py-4 px-6`}>
                        <div css={tw`w-1/2`} style={{ color: 'var(--color-base)' }}>0 0 * * *</div>
                        <div css={tw`w-1/2`} style={{ color: 'var(--color-muted)' }}>once a day</div>
                    </div>
                    <div css={tw`flex py-4 px-6`} style={{ backgroundColor: 'var(--color-neutral)' }}>
                        <div css={tw`w-1/2`} style={{ color: 'var(--color-base)' }}>0 0 * * MON</div>
                        <div css={tw`w-1/2`} style={{ color: 'var(--color-muted)' }}>every Monday</div>
                    </div>
                </div>
            </div>
            <div css={tw`md:w-1/2 h-full`} style={{ backgroundColor: 'var(--color-background-secondary)' }}>
                <h2 css={tw`py-4 px-6 font-bold`} style={{ color: 'var(--color-base)' }}>Special Characters</h2>
                <div css={tw`flex flex-col`}>
                    <div css={tw`flex py-4 px-6`} style={{ backgroundColor: 'var(--color-neutral)' }}>
                        <div css={tw`w-1/2`} style={{ color: 'var(--color-base)' }}>*</div>
                        <div css={tw`w-1/2`} style={{ color: 'var(--color-muted)' }}>any value</div>
                    </div>
                    <div css={tw`flex py-4 px-6`}>
                        <div css={tw`w-1/2`} style={{ color: 'var(--color-base)' }}>,</div>
                        <div css={tw`w-1/2`} style={{ color: 'var(--color-muted)' }}>value list separator</div>
                    </div>
                    <div css={tw`flex py-4 px-6`} style={{ backgroundColor: 'var(--color-neutral)' }}>
                        <div css={tw`w-1/2`} style={{ color: 'var(--color-base)' }}>-</div>
                        <div css={tw`w-1/2`} style={{ color: 'var(--color-muted)' }}>range values</div>
                    </div>
                    <div css={tw`flex py-4 px-6`}>
                        <div css={tw`w-1/2`} style={{ color: 'var(--color-base)' }}>/</div>
                        <div css={tw`w-1/2`} style={{ color: 'var(--color-muted)' }}>step values</div>
                    </div>
                </div>
            </div>
        </>
    );
};
