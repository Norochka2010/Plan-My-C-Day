/** Explain registration failures without displaying server details or personal data. */
export function signupErrorMessage(error: unknown, stage: 'username' | 'account'): string {
  const value = error && typeof error === 'object' ? error as { code?: string; name?: string; status?: number } : {};
  const code = value.code;
  if (code === 'weak_password') return 'This password does not meet the account security requirements. Try a different, unique passphrase with at least 12 characters, including uppercase and lowercase letters, a number, and a symbol.';
  if (code === 'email_address_invalid') return 'The sign-in service could not accept this email address. Check for typos and extra spaces.';
  if (code === 'email_address_not_authorized') return 'The email service cannot send a confirmation to this address right now. Please contact app support; changing your password will not resolve this.';
  if (code === 'signup_disabled') return 'New account registration is temporarily unavailable. Please try again later.';
  if (code === 'captcha_failed') return 'The security check could not finish. Please try again or contact app support if it continues.';
  if (value.name === 'AuthRetryableFetchError' || value.name === 'TypeError' || value.status === 0) return 'Could not reach the account service. Check your connection and try again.';
  if (stage === 'username') return 'We could not check your username right now. Please try again shortly. If this continues, contact app support and mention SIGNUP-USERNAME.';
  if (code === 'unexpected_failure' || code === 'database_error') return 'The account service could not finish setting up your profile. Please contact app support and mention SIGNUP-PROFILE. Trying different email addresses may not help.';
  return 'Account creation could not finish. Please try again shortly. If it happens again, contact app support with the time of your attempt and reference SIGNUP-ACCOUNT. Never send your password.';
}
