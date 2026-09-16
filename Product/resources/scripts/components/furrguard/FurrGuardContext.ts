import { createContext, useContext } from 'react';
import { FurrSession, Section, SessionUser } from '@/api/furrguard/types';

/** Key of the flash messages shown at the top of the FurrGuard page. */
export const FURRGUARD_FLASH_KEY = 'furrguard';

export type NoticeType = 'success' | 'error' | 'warning' | 'info';

export interface FurrGuardContextValue {
    user: SessionUser;
    permissions: readonly Section[];
    can: (section: Section) => boolean;
    /** Whether FurrGuard sends IPs to this role at all (§4.3). */
    canSeeIps: boolean;
    /** Browser-side "hide IPs" switch, for screen sharing. */
    hideIps: boolean;
    setHideIps: (hidden: boolean) => void;
    /** Short feedback message; success ones vanish on their own. */
    notify: (message: string, type?: NoticeType) => void;
    /** Shows the message of a failed call, except when it was a lost session (the gate explains that). */
    notifyError: (error: unknown, fallback?: string) => void;
    /** Returns true (after handling it) when the error means the FurrGuard session is gone. */
    interceptError: (error: unknown) => boolean;
    /** Re-asks the panel who the user is (role or permissions may have changed). */
    refreshSession: () => void;
    signOut: () => void;
}

export const FurrGuardContext = createContext<FurrGuardContextValue | null>(null);

export const useFurrGuard = (): FurrGuardContextValue => {
    const value = useContext(FurrGuardContext);
    if (!value) {
        throw new Error('useFurrGuard() must be used inside the FurrGuard workspace.');
    }

    return value;
};

export const sessionCanSeeIps = (session: FurrSession): boolean => session.can_see_ips === true;
