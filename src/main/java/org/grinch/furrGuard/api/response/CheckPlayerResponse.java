package org.grinch.furrGuard.api.response;

public class CheckPlayerResponse {

    private boolean success;
    private String error;
    private boolean allowed;
    private String reason;
    private String blockReason;
    private String blockType;
    private String country;
    private String countryCode;
    private String isp;
    private String org;
    private String asn;
    private boolean proxy;
    private boolean hosting;
    private boolean mobile;
    private String expiresAt;
    private String banId;
    private String blockedName;

    public CheckPlayerResponse() {
        this.success = true;
        this.allowed = true;
    }

    public static CheckPlayerResponse error(String message) {
        CheckPlayerResponse response = new CheckPlayerResponse();
        response.setSuccess(false);
        response.setError(message);
        response.setAllowed(true); // Allow by default for backward compatibility
        return response;
    }

    public static CheckPlayerResponse error(String errorType, String message, boolean allowed) {
        CheckPlayerResponse response = new CheckPlayerResponse();
        response.setSuccess(false);
        response.setError(errorType + ": " + message);
        response.setAllowed(allowed); // Explicit control over allow/deny
        response.setReason(errorType);
        return response;
    }

    public static CheckPlayerResponse allowed() {
        CheckPlayerResponse response = new CheckPlayerResponse();
        response.setSuccess(true);
        response.setAllowed(true);
        return response;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getError() {
        return error;
    }

    public void setError(String error) {
        this.error = error;
    }

    public boolean isAllowed() {
        return allowed;
    }

    public void setAllowed(boolean allowed) {
        this.allowed = allowed;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getBlockReason() {
        return blockReason;
    }

    public void setBlockReason(String blockReason) {
        this.blockReason = blockReason;
    }

    public String getBlockType() {
        return blockType;
    }

    public void setBlockType(String blockType) {
        this.blockType = blockType;
    }

    public String getCountry() {
        return country;
    }

    public void setCountry(String country) {
        this.country = country;
    }

    public String getCountryCode() {
        return countryCode;
    }

    public void setCountryCode(String countryCode) {
        this.countryCode = countryCode;
    }

    public String getIsp() {
        return isp;
    }

    public void setIsp(String isp) {
        this.isp = isp;
    }

    public String getOrg() {
        return org;
    }

    public void setOrg(String org) {
        this.org = org;
    }

    public String getAsn() {
        return asn;
    }

    public void setAsn(String asn) {
        this.asn = asn;
    }

    public boolean isProxy() {
        return proxy;
    }

    public void setProxy(boolean proxy) {
        this.proxy = proxy;
    }

    public boolean isHosting() {
        return hosting;
    }

    public void setHosting(boolean hosting) {
        this.hosting = hosting;
    }

    public boolean isMobile() {
        return mobile;
    }

    public void setMobile(boolean mobile) {
        this.mobile = mobile;
    }

    public String getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(String expiresAt) {
        this.expiresAt = expiresAt;
    }

    public String getBanId() {
        return banId;
    }

    public void setBanId(String banId) {
        this.banId = banId;
    }

    public String getBlockedName() {
        return blockedName;
    }

    public void setBlockedName(String blockedName) {
        this.blockedName = blockedName;
    }
}