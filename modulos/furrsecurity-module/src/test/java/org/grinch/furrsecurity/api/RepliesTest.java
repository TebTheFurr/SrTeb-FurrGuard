package org.grinch.furrsecurity.api;

import org.grinch.furrguard.common.http.ApiResult.Kind;
import org.grinch.furrsecurity.api.Replies.CheckStatus;
import org.grinch.furrsecurity.api.Replies.CheckStatus.Decision;
import org.grinch.furrsecurity.api.Replies.TokenGrant;
import org.grinch.furrsecurity.api.Replies.TokenStatus;
import org.grinch.furrsecurity.api.Replies.TokenStatus.State;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.EnumSource;

import java.util.Set;

import static org.grinch.furrsecurity.support.FakeApi.failure;
import static org.grinch.furrsecurity.support.FakeApi.ok;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class RepliesTest {

    @ParameterizedTest
    @EnumSource(Kind.class)
    void everyFailureOfCheckStatusMeansLockAndRetry(Kind kind) {
        assertEquals(Decision.RETRY, CheckStatus.from(failure(kind)).decision());
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "{\"needs_verification\":false,\"reason\":\"already_verified\"} | UNLOCK",
            "{\"needs_verification\":0,\"reason\":\"module_disabled\"}        | UNLOCK",
            "{\"needs_verification\":true,\"reason\":\"ip_changed\"}          | VERIFY",
            "{\"needs_verification\":\"quizas\"}                              | VERIFY",
            "{\"needs_verification\":null}                                    | VERIFY",
            "{\"reason\":\"already_verified\"}                                | RETRY",
            "{}                                                               | RETRY"})
    void onlyAnExplicitFalseUnlocks(String body, Decision expected) {
        assertEquals(expected, CheckStatus.from(ok(body)).decision());
    }

    @Test
    void checkStatusCarriesTheSessionTime() {
        CheckStatus status = CheckStatus.from(ok("{\"needs_verification\":false,\"reason\":\"already_verified\","
                + "\"session\":{\"time_remaining_seconds\":\"1200\"}}"));

        assertEquals("already_verified", status.reason());
        assertEquals(1200, status.sessionSeconds());
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "{\"status\":\"pending\",\"verified\":false}           | PENDING",
            "{\"status\":\"verified\",\"verified\":true}           | VERIFIED",
            "{\"status\":\"verified\",\"verified\":false}          | PENDING",
            "{\"status\":\"token_expired\",\"verified\":false}     | EXPIRED",
            "{\"status\":\"expired\",\"verified\":false}           | EXPIRED",
            "{\"status\":\"not_found\",\"verified\":false}         | NOT_FOUND",
            "{\"status\":\"otro\"}                                 | PENDING"})
    void tokenStatuses(String body, State expected) {
        assertEquals(expected, TokenStatus.from(ok(body)).state());
    }

    @Test
    void aFailedPollKeepsWaiting() {
        assertEquals(State.PENDING, TokenStatus.from(failure(Kind.TIMEOUT)).state());
    }

    @Test
    void aTokenNeedsSuccessTokenAndUrl() {
        assertEquals("t", TokenGrant.from(ok("{\"success\":true,\"token\":\"t\",\"verify_url\":\"https://x\"}")).token());
        assertNull(TokenGrant.from(ok("{\"success\":false,\"error\":\"not_in_whitelist\"}")));
        assertNull(TokenGrant.from(ok("{\"success\":true,\"token\":\"t\"}")));
        assertNull(TokenGrant.from(failure(Kind.SERVER_ERROR)));
    }

    @Test
    void sessionSecondsDistinguishesNoSessionFromFailure() {
        assertEquals(90, Replies.sessionSeconds(ok("{\"has_session\":true,\"session\":{\"time_remaining_seconds\":90}}")));
        assertEquals(0, Replies.sessionSeconds(ok("{\"has_session\":false}")));
        assertEquals(-1, Replies.sessionSeconds(failure(Kind.NETWORK)));
    }

    @Test
    void staffListIsNormalized() {
        assertEquals(Set.of("mod", "admin"), Replies.staffNicks(ok("{\"staff\":[{\"nick\":\"Mod\"},{\"nick\":\"*Admin\"},{\"x\":1},7]}")));
        assertNull(Replies.staffNicks(ok("{\"staff\":{}}")));
        assertNull(Replies.staffNicks(failure(Kind.UNAUTHORIZED)));
    }

    @Test
    void retryDelaysRespectRetryAfterAndBackOffOnConfigurationErrors() {
        assertEquals(30_000, Replies.retryDelayMillis(failure(Kind.RATE_LIMITED)));
        assertEquals(Replies.SLOW_RETRY_MILLIS, Replies.retryDelayMillis(failure(Kind.UNAUTHORIZED)));
        assertEquals(Replies.RETRY_MILLIS, Replies.retryDelayMillis(failure(Kind.TIMEOUT)));
    }
}
