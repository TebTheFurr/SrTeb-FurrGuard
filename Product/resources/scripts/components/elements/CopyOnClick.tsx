import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Fade from '@/components/elements/Fade';
import Portal from '@/components/elements/Portal';
import copy from 'copy-to-clipboard';
import classNames from 'classnames';

interface CopyOnClickProps {
    text: string | number | null | undefined;
    showInNotification?: boolean;
    children: React.ReactNode;
}

const hasProtocol = (value: string) => /^(https?:\/\/)/i.test(value);

const isAddressWithPort = (value: string) =>
    /^(localhost|(?:\d{1,3}\.){3}\d{1,3}|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z0-9-]+):\d{1,5}$/.test(value);

const CopyOnClick = ({ text, showInNotification = true, children }: CopyOnClickProps) => {
    const { t } = useTranslation('strings');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!copied) return;

        const timeout = setTimeout(() => {
            setCopied(false);
        }, 2500);

        return () => {
            clearTimeout(timeout);
        };
    }, [copied]);

    if (!React.isValidElement(children)) {
        throw new Error('Component passed to <CopyOnClick/> must be a valid React element.');
    }

    const child = !text
        ? React.Children.only(children)
        : React.cloneElement(React.Children.only(children), {
              // @ts-expect-error todo: check on this
              className: classNames(children.props.className || '', 'cursor-pointer'),
              onClick: (e: React.MouseEvent<HTMLElement>) => {
                  const value = String(text).trim();
                  if ((e.ctrlKey || e.metaKey) && isAddressWithPort(value)) {
                      const url = hasProtocol(value) ? value : `http://${value}`;
                      window.open(url, '_blank', 'noopener,noreferrer');
                      if (typeof children.props.onClick === 'function') {
                          children.props.onClick(e);
                      }
                      return;
                  }

                  copy(String(text));
                  setCopied(true);
                  if (typeof children.props.onClick === 'function') {
                      children.props.onClick(e);
                  }
              },
          });

    return (
        <>
            {copied && (
                <Portal>
                    <Fade in appear timeout={250} key={copied ? 'visible' : 'invisible'}>
                        <div className={'fixed z-50 bottom-0 right-0 m-4'}>
                            <div
                                className={'py-3 px-4'}
                                style={{
                                    backgroundColor: 'var(--color-background-secondary)',
                                    border: '1px solid var(--color-neutral)',
                                    borderRadius: 'var(--border-radius, 12px)',
                                    color: 'var(--color-base)',
                                }}
                            >
                                <p>
                                    {showInNotification
                                        ? t('copied_text_to_clipboard', { text: String(text) })
                                        : t('copied_to_clipboard')}
                                </p>
                            </div>
                        </div>
                    </Fade>
                </Portal>
            )}
            {child}
        </>
    );
};

export default CopyOnClick;
