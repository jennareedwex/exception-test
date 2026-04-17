import { useId, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import './BankAccountsAddUs.css'

/** Figma MCP asset URLs (valid ~7 days from export) */
const ASSETS = {
  oval: 'https://www.figma.com/api/mcp/asset/020c38c4-4a80-435a-934f-74aee6b66841',
  wexLogo: 'https://www.figma.com/api/mcp/asset/5741850e-39d8-4bef-8ed3-7d484874e0c1',
  payee: 'https://www.figma.com/api/mcp/asset/533eb22c-0eeb-4160-a148-1e494e192819',
  date: 'https://www.figma.com/api/mcp/asset/56a243cd-53c5-4e21-8213-961532eecf7c',
  autograph: 'https://www.figma.com/api/mcp/asset/b534c906-4105-4342-8b25-42e0671aca97',
  amount: 'https://www.figma.com/api/mcp/asset/62b2f9e0-1b86-4f18-9449-b7ac95732ba9',
  routingHighlight: 'https://www.figma.com/api/mcp/asset/fa9084b1-ea37-416e-8ce7-c232aea990a5',
  accountHighlight: 'https://www.figma.com/api/mcp/asset/3b303349-9551-4c2e-8046-cc0084ff34ec',
  checkSuffix: 'https://www.figma.com/api/mcp/asset/74e07b7a-c939-4ec3-b504-3bb07d0047c4',
} as const

/** ABA routing number checksum (weights 3,7,1, …) — 9 digits only */
const ABA_WEIGHTS = [3, 7, 1, 3, 7, 1, 3, 7, 1] as const

function isAbaRoutingChecksumValid(routing: string): boolean {
  if (routing.length !== 9 || !/^\d{9}$/.test(routing)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(routing[i]!, 10) * ABA_WEIGHTS[i]!
  }
  return sum % 10 === 0
}

export default function BankAccountsAddUs() {
  const baseId = useId()
  const [bankAccountName, setBankAccountName] = useState('')
  const [routingNumber, setRoutingNumber] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [confirmAccount, setConfirmAccount] = useState('')
  const [defaultPayment, setDefaultPayment] = useState(false)
  const [attemptCount, setAttemptCount] = useState(0)
  const [nameFocused, setNameFocused] = useState(false)
  const [routingFocused, setRoutingFocused] = useState(false)
  const [accountFocused, setAccountFocused] = useState(false)
  const [confirmFocused, setConfirmFocused] = useState(false)
  const [scenarioForceBanner, setScenarioForceBanner] = useState(false)
  /** Figma 5:3998 — compound routing + account errors (banner + field states) */
  const [scenarioCompoundErrors, setScenarioCompoundErrors] = useState(false)
  /** Figma 5:4320 — unassigned / routing not recognized (warning banner only; field errors suppressed to match design) */
  const [scenarioUnassignedBank, setScenarioUnassignedBank] = useState(false)
  /** Figma 5:3920 — duplicate / bank already linked (warning banner; same field pattern as unassigned) */
  const [scenarioDuplicateAccount, setScenarioDuplicateAccount] = useState(false)
  const [activeScenario, setActiveScenario] = useState<
    'default' | 'valid' | 'mod10' | 'length' | 'mismatch' | 'toast' | 'compound' | 'unassigned' | 'duplicate'
  >('default')

  const field = (suffix: string) => `${baseId}-${suffix}`

  const isFormIncomplete =
    !bankAccountName.trim() ||
    routingNumber.length === 0 ||
    accountNumber.length === 0 ||
    confirmAccount.length === 0

  /** Real-time validation (as user types) */
  const nicknameTooShort =
    bankAccountName.length > 0 && bankAccountName.trim().length < 2

  const routingLengthInvalid =
    routingNumber.length > 0 && routingNumber.length < 9

  const routingChecksumInvalid =
    routingNumber.length === 9 && !isAbaRoutingChecksumValid(routingNumber)

  const routingFieldInvalid = routingLengthInvalid || routingChecksumInvalid

  const confirmMismatchLive =
    confirmAccount.length > 0 && accountNumber !== confirmAccount

  /** Suppress confirm mismatch UI for demos where Figma omits it (compound, unassigned, duplicate). */
  const confirmMismatchDisplayed =
    confirmMismatchLive &&
    !scenarioCompoundErrors &&
    !scenarioUnassignedBank &&
    !scenarioDuplicateAccount

  /** Field-level routing errors hidden for banner-only routing demos (Figma 5:4320, 5:3920). */
  const routingFieldInvalidForUi =
    routingFieldInvalid && !scenarioUnassignedBank && !scenarioDuplicateAccount

  /** Account number: invalid if 1–5 digits (valid range per copy is 6–17) */
  const accountLengthInvalid =
    accountNumber.length >= 1 && accountNumber.length <= 5

  /** Figma 5:3998 — invalid account format (paired with invalid routing). */
  const accountCompoundFormatInvalid =
    scenarioCompoundErrors && accountNumber === '123456789'

  const accountFieldInvalid = accountLengthInvalid || accountCompoundFormatInvalid

  const hasValidationError =
    nicknameTooShort ||
    (!scenarioUnassignedBank && !scenarioDuplicateAccount && routingFieldInvalid) ||
    accountLengthInvalid ||
    accountCompoundFormatInvalid ||
    confirmMismatchDisplayed

  /** Attempt 3+: red verification banner; server-timeout scenario: warning banner (Figma 5:4076) */
  const showServerTimeoutBanner = scenarioForceBanner
  const showUnassignedBankBanner = scenarioUnassignedBank
  const showDuplicateAccountBanner = scenarioDuplicateAccount
  const showVerificationFailedBanner =
    attemptCount >= 3 &&
    !scenarioForceBanner &&
    !scenarioCompoundErrors &&
    !scenarioUnassignedBank &&
    !scenarioDuplicateAccount
  const showCompoundErrorsBanner = scenarioCompoundErrors

  const nameFloating =
    bankAccountName.length > 0 || nameFocused || nicknameTooShort
  const routingFloating =
    routingNumber.length > 0 || routingFocused || routingFieldInvalidForUi
  const accountFloating =
    accountNumber.length > 0 || accountFocused || accountFieldInvalid
  const confirmFloating =
    confirmAccount.length > 0 || confirmFocused || confirmMismatchDisplayed

  const nameErrorId = field('name-error')
  const accountErrorId = field('account-error')
  const confirmErrorId = field('confirm-error')
  const routingErrorId = field('routing-error')

  const applyTestScenario = (
    scenario:
      | 'default'
      | 'valid'
      | 'mod10'
      | 'length'
      | 'mismatch'
      | 'toast'
      | 'compound'
      | 'unassigned'
      | 'duplicate',
  ) => {
    setActiveScenario(scenario)
    setScenarioForceBanner(false)
    setScenarioCompoundErrors(false)
    setScenarioUnassignedBank(false)
    setScenarioDuplicateAccount(false)
    setAttemptCount(0)
    switch (scenario) {
      case 'default':
        setBankAccountName('')
        setRoutingNumber('')
        setAccountNumber('')
        setConfirmAccount('')
        setDefaultPayment(false)
        break
      case 'valid':
        setBankAccountName('Checking')
        setRoutingNumber('121000248')
        setAccountNumber('1234567890')
        setConfirmAccount('1234567890')
        break
      case 'mod10':
        setBankAccountName('Checking')
        setRoutingNumber('123456789')
        setAccountNumber('123456789012')
        setConfirmAccount('123456789012')
        break
      case 'length':
        setBankAccountName('Checking')
        setRoutingNumber('121000248')
        setAccountNumber('1234')
        setConfirmAccount('1234')
        break
      case 'mismatch':
        setBankAccountName('Checking')
        setRoutingNumber('121000248')
        setAccountNumber('1111111111')
        setConfirmAccount('2222222222')
        break
      case 'toast':
        setBankAccountName('Checking')
        setRoutingNumber('121000248')
        setAccountNumber('123456789012')
        setConfirmAccount('123456789012')
        setScenarioForceBanner(true)
        break
      case 'compound':
        setBankAccountName('US BANK')
        setRoutingNumber('123456789')
        setAccountNumber('123456789')
        setConfirmAccount('1234567890')
        setDefaultPayment(true)
        setScenarioCompoundErrors(true)
        break
      case 'unassigned':
        setBankAccountName('US BANK')
        setRoutingNumber('123456789')
        setAccountNumber('123456789')
        setConfirmAccount('1234567890')
        setDefaultPayment(true)
        setScenarioUnassignedBank(true)
        break
      case 'duplicate':
        setBankAccountName('US BANK')
        setRoutingNumber('123456789')
        setAccountNumber('123456789')
        setConfirmAccount('1234567890')
        setDefaultPayment(true)
        setScenarioDuplicateAccount(true)
        break
      default:
        break
    }
  }

  const wexLogoContainerStyle: CSSProperties = {
    display: 'block',
    width: 'fit-content',
  }

  const wexLogoStyle: CSSProperties = {
    display: 'block',
    height: '32px',
    width: 'auto',
    aspectRatio: '3.5 / 1',
    objectFit: 'contain',
  }

  const headerActionsStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '1.5rem',
  }

  const modalBackdropStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    margin: 0,
    padding: 0,
    zIndex: 200,
  }

  const modalLayer = (
    <>
      <div
        className="bank-screen__overlay"
        style={modalBackdropStyle}
        aria-hidden
      />
      <div className="bank-screen__modal-cluster">
        <div
          className="bank-screen__dialog bank-screen__dialog--in-cluster"
          role="dialog"
          aria-modal="true"
          aria-labelledby={field('dialog-title')}
        >
        <div className="bank-screen__dialog-scroll">
        <div className="bank-screen__dialog-heading">
          <div className="bank-screen__dialog-title-row">
            <i className="fa-solid fa-building-columns bank-screen__icon bank-screen__icon--lg" aria-hidden />
            <h1 id={field('dialog-title')} className="bank-screen__dialog-title">
              Add bank account
            </h1>
          </div>
          <div className="bank-screen__dialog-controls">
            <button type="button" className="bank-screen__icon-btn" aria-label="Close dialog">
              <i className="fa-solid fa-xmark bank-screen__close-icon" aria-hidden />
            </button>
          </div>
        </div>

        {showServerTimeoutBanner ? (
          <div
            className="bank-screen__modal-alert bank-screen__modal-alert--warning"
            role="alert"
            aria-live="polite"
          >
            <div className="bank-screen__modal-alert-warning-inner">
              <span className="bank-screen__modal-alert-warning-icon" aria-hidden>
                <i className="fa-solid fa-triangle-exclamation" />
              </span>
              <div className="bank-screen__modal-alert-warning-text">
                <p className="bank-screen__modal-alert-warning-title">Server timeout</p>
                <p className="bank-screen__modal-alert-warning-body">
                  We&apos;re having trouble connecting to the banking registry. Your information has been
                  retained; please wait a moment and try clicking &quot;Add account&quot; again.
                </p>
              </div>
            </div>
          </div>
        ) : null}
        {showUnassignedBankBanner ? (
          <div
            className="bank-screen__modal-alert bank-screen__modal-alert--warning"
            role="alert"
            aria-live="polite"
          >
            <div className="bank-screen__modal-alert-warning-inner">
              <span className="bank-screen__modal-alert-warning-icon" aria-hidden>
                <i className="fa-solid fa-triangle-exclamation" />
              </span>
              <div className="bank-screen__modal-alert-warning-text">
                <p className="bank-screen__modal-alert-warning-title">Routing number not recognized</p>
                <p className="bank-screen__modal-alert-warning-body">
                  This routing number is not currently assigned to an active bank. Please verify you are
                  using a 9-digit electronic or ACH routing number.
                </p>
              </div>
            </div>
          </div>
        ) : null}
        {showDuplicateAccountBanner ? (
          <div
            className="bank-screen__modal-alert bank-screen__modal-alert--warning"
            role="alert"
            aria-live="polite"
          >
            <div className="bank-screen__modal-alert-warning-inner">
              <span className="bank-screen__modal-alert-warning-icon" aria-hidden>
                <i className="fa-solid fa-triangle-exclamation" />
              </span>
              <div className="bank-screen__modal-alert-warning-text">
                <p className="bank-screen__modal-alert-warning-title">Bank already linked</p>
                <p className="bank-screen__modal-alert-warning-body">
                  This bank account is already associated with your profile. To make changes or set it as
                  your default, please visit your existing payment methods.
                </p>
              </div>
            </div>
          </div>
        ) : null}
        {showCompoundErrorsBanner ? (
          <div
            className="bank-screen__modal-alert bank-screen__modal-alert--critical"
            role="alert"
            aria-live="polite"
          >
            <div className="bank-screen__modal-alert-critical-inner">
              <span className="bank-screen__modal-alert-critical-icon" aria-hidden>
                <i className="fa-solid fa-circle-exclamation" />
              </span>
              <div className="bank-screen__modal-alert-critical-text">
                <p className="bank-screen__modal-alert-critical-title">2 errors need correction</p>
                <p className="bank-screen__modal-alert-critical-body">
                  We found issues with both the routing and account numbers. Please check your entries
                  against a check or bank statement to ensure all digits are correct.
                </p>
              </div>
            </div>
          </div>
        ) : null}
        {showVerificationFailedBanner ? (
          <div
            className="bank-screen__modal-alert"
            role="alert"
            aria-live="polite"
          >
            <p className="bank-screen__modal-alert-text">
              We were unable to verify this bank account. Please check your details and try again.
            </p>
          </div>
        ) : null}

        <p className="bank-screen__intro">
          Account and routing numbers can be found at the bottom of your business’s checks.
        </p>

        <div className="bank-screen__check-panel">
          <div className="bank-screen__check-wrap">
            <div className="bank-screen__check" data-name="check">
              <div className="bank-screen__check-border" />
              <p className="bank-screen__check-micro bank-screen__check-payto">
                Pay to
                <br />
                the order of
              </p>
              <div className="bank-screen__check-stripe bank-screen__check-stripe--payee">
                <img src={ASSETS.payee} alt="" />
              </div>
              <div className="bank-screen__check-stripe bank-screen__check-stripe--date">
                <img src={ASSETS.date} alt="" />
              </div>
              <div className="bank-screen__check-stripe bank-screen__check-stripe--autograph">
                <img src={ASSETS.autograph} alt="" />
              </div>
              <div className="bank-screen__check-amount-wrap">
                <div className="bank-screen__check-stripe bank-screen__check-stripe--amount">
                  <img src={ASSETS.amount} alt="" />
                </div>
                <p className="bank-screen__check-micro bank-screen__check-dollars">Dollars</p>
              </div>
              <div className="bank-screen__check-amount-box">
                <p className="bank-screen__check-micro bank-screen__check-dollar">$</p>
                <div className="bank-screen__check-amount-square" />
              </div>
              <p className="bank-screen__check-micro bank-screen__check-2400">2400</p>
              <div className="bank-screen__check-for">
                <p className="bank-screen__check-micro">FOR</p>
                <div className="bank-screen__check-stripe bank-screen__check-stripe--for">
                  <img src={ASSETS.date} alt="" />
                </div>
              </div>
              <div className="bank-screen__micr bank-screen__micr--a">
                <img src={ASSETS.routingHighlight} alt="" />
              </div>
              <div className="bank-screen__micr bank-screen__micr--b">
                <img src={ASSETS.accountHighlight} alt="" />
              </div>
              <div className="bank-screen__micr bank-screen__micr--c">
                <img src={ASSETS.checkSuffix} alt="" />
              </div>
              <div className="bank-screen__check-highlight bank-screen__check-highlight--routing" />
              <div className="bank-screen__check-highlight bank-screen__check-highlight--account" />
            </div>
          </div>
          <div className="bank-screen__check-tags">
            <span className="bank-screen__tag bank-screen__tag--routing">Routing number</span>
            <span className="bank-screen__tag bank-screen__tag--account">Account number</span>
          </div>
        </div>

        <form
          className="bank-screen__fields"
          onSubmit={(e) => {
            e.preventDefault()
            if (isFormIncomplete || hasValidationError) return
            setAttemptCount((c) => c + 1)
          }}
        >
          <div className="bank-screen__field">
            <div
              className={[
                'bank-screen__float-wrap',
                nameFloating ? 'bank-screen__float-wrap--active' : '',
                nicknameTooShort ? 'bank-screen__float-wrap--error' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <label htmlFor={field('name')} className="bank-screen__float-label">
                Create bank account nickname
              </label>
              <input
                id={field('name')}
                className="bank-screen__float-input"
                placeholder=""
                maxLength={50}
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                autoComplete="off"
                aria-invalid={nicknameTooShort}
                aria-describedby={nicknameTooShort ? nameErrorId : undefined}
              />
            </div>
            {nicknameTooShort ? (
              <p id={nameErrorId} className="bank-screen__helper bank-screen__helper--error" role="alert">
                Enter at least 2 characters
              </p>
            ) : (
              <p className="bank-screen__helper">Max 50 characters</p>
            )}
          </div>

          <div className="bank-screen__field">
            <div
              className={[
                'bank-screen__float-wrap',
                routingFloating ? 'bank-screen__float-wrap--active' : '',
                routingFieldInvalidForUi ? 'bank-screen__float-wrap--error' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <label htmlFor={field('routing')} className="bank-screen__float-label">
                Routing number
              </label>
              <input
                id={field('routing')}
                className="bank-screen__float-input"
                placeholder=""
                inputMode="numeric"
                maxLength={9}
                value={routingNumber}
                onChange={(e) => {
                  setRoutingNumber(e.target.value.replace(/\D/g, ''))
                  setScenarioCompoundErrors(false)
                  setScenarioUnassignedBank(false)
                  setScenarioDuplicateAccount(false)
                }}
                onFocus={() => setRoutingFocused(true)}
                onBlur={() => setRoutingFocused(false)}
                autoComplete="off"
                aria-invalid={routingFieldInvalidForUi}
                aria-describedby={routingFieldInvalidForUi ? routingErrorId : undefined}
              />
            </div>
            {scenarioUnassignedBank || scenarioDuplicateAccount ? (
              <p className="bank-screen__helper">Max 9 digits</p>
            ) : routingLengthInvalid ? (
              <p id={routingErrorId} className="bank-screen__helper bank-screen__helper--error" role="alert">
                Routing number must be 9 digits
              </p>
            ) : routingChecksumInvalid ? (
              <p id={routingErrorId} className="bank-screen__helper bank-screen__helper--error" role="alert">
                This routing number is invalid. Please check your paper check.
              </p>
            ) : (
              <p className="bank-screen__helper">Max 9 digits</p>
            )}
          </div>

          <div className="bank-screen__field">
            <div
              className={[
                'bank-screen__float-wrap',
                accountFloating ? 'bank-screen__float-wrap--active' : '',
                accountFieldInvalid ? 'bank-screen__float-wrap--error' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <label htmlFor={field('account')} className="bank-screen__float-label">
                Account number
              </label>
              <input
                id={field('account')}
                className="bank-screen__float-input"
                placeholder=""
                inputMode="numeric"
                maxLength={20}
                value={accountNumber}
                onChange={(e) => {
                  setAccountNumber(e.target.value.replace(/\D/g, ''))
                  setScenarioCompoundErrors(false)
                  setScenarioUnassignedBank(false)
                  setScenarioDuplicateAccount(false)
                }}
                onFocus={() => setAccountFocused(true)}
                onBlur={() => setAccountFocused(false)}
                autoComplete="off"
                aria-invalid={accountFieldInvalid}
                aria-describedby={accountFieldInvalid ? accountErrorId : undefined}
              />
            </div>
            {accountLengthInvalid ? (
              <p id={accountErrorId} className="bank-screen__helper bank-screen__helper--error" role="alert">
                Min 6 digits
              </p>
            ) : accountCompoundFormatInvalid ? (
              <p id={accountErrorId} className="bank-screen__helper bank-screen__helper--error" role="alert">
                Check account number format.
              </p>
            ) : (
              <p className="bank-screen__helper">Max 20 digits</p>
            )}
          </div>

          <div className="bank-screen__field">
            <div
              className={[
                'bank-screen__float-wrap',
                confirmFloating ? 'bank-screen__float-wrap--active' : '',
                confirmMismatchDisplayed ? 'bank-screen__float-wrap--error' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <label htmlFor={field('confirm')} className="bank-screen__float-label">
                Confirm account number
              </label>
              <input
                id={field('confirm')}
                className="bank-screen__float-input"
                placeholder=""
                inputMode="numeric"
                maxLength={20}
                value={confirmAccount}
                onChange={(e) => setConfirmAccount(e.target.value.replace(/\D/g, ''))}
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
                autoComplete="off"
                aria-invalid={confirmMismatchDisplayed}
                aria-describedby={confirmMismatchDisplayed ? confirmErrorId : undefined}
              />
            </div>
            {confirmMismatchDisplayed ? (
              <p id={confirmErrorId} className="bank-screen__helper bank-screen__helper--error" role="alert">
                Account numbers do not match.
              </p>
            ) : (
              <p className="bank-screen__helper">Max 20 digits</p>
            )}
          </div>

          <label className="bank-screen__checkbox">
            <input
              type="checkbox"
              checked={defaultPayment}
              onChange={(e) => setDefaultPayment(e.target.checked)}
            />
            <span className="bank-screen__checkbox-ui" aria-hidden />
            <span>Make this my default payment method</span>
          </label>

          <div className="bank-screen__actions">
            <button type="button" className="bank-screen__btn bank-screen__btn--ghost">
              Cancel
            </button>
            <button
              type="submit"
              className="bank-screen__btn bank-screen__btn--primary"
              disabled={isFormIncomplete || hasValidationError}
            >
              Add account
            </button>
          </div>
        </form>
        </div>
        </div>

        <aside
          className="bank-screen__scenario-menu"
          aria-label="Test scenarios"
        >
          <h2 className="bank-screen__scenario-menu-title">Test Scenarios</h2>
          <div className="bank-screen__scenario-menu-actions">
            <button
              type="button"
              className={[
                'bank-screen__scenario-btn',
                activeScenario === 'default' ? 'bank-screen__scenario-btn--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => applyTestScenario('default')}
            >
              Default (empty form)
            </button>
            <button
              type="button"
              className={[
                'bank-screen__scenario-btn',
                activeScenario === 'valid' ? 'bank-screen__scenario-btn--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => applyTestScenario('valid')}
            >
              Valid bank account
            </button>
            <button
              type="button"
              className={[
                'bank-screen__scenario-btn',
                activeScenario === 'mod10' ? 'bank-screen__scenario-btn--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => applyTestScenario('mod10')}
            >
              Invalid routing number
            </button>
            <button
              type="button"
              className={[
                'bank-screen__scenario-btn',
                activeScenario === 'length' ? 'bank-screen__scenario-btn--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => applyTestScenario('length')}
            >
              Length Mismatch
            </button>
            <button
              type="button"
              className={[
                'bank-screen__scenario-btn',
                activeScenario === 'mismatch' ? 'bank-screen__scenario-btn--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => applyTestScenario('mismatch')}
            >
              Account Mismatch
            </button>
            <button
              type="button"
              className={[
                'bank-screen__scenario-btn',
                activeScenario === 'toast' ? 'bank-screen__scenario-btn--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => applyTestScenario('toast')}
            >
              Server timeout
            </button>
            <button
              type="button"
              className={[
                'bank-screen__scenario-btn',
                activeScenario === 'compound' ? 'bank-screen__scenario-btn--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => applyTestScenario('compound')}
            >
              Compound errors
            </button>
            <button
              type="button"
              className={[
                'bank-screen__scenario-btn',
                activeScenario === 'unassigned' ? 'bank-screen__scenario-btn--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => applyTestScenario('unassigned')}
            >
              Unassigned bank
            </button>
            <button
              type="button"
              className={[
                'bank-screen__scenario-btn',
                activeScenario === 'duplicate' ? 'bank-screen__scenario-btn--selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => applyTestScenario('duplicate')}
            >
              Bank already linked
            </button>
          </div>
        </aside>
      </div>
    </>
  )

  return (
    <>
      <div className="bank-screen">
        <header className="bank-screen__header" data-node-id="1:100" data-name="Top Nav">
          <div style={wexLogoContainerStyle}>
            <img
              src={ASSETS.wexLogo}
              alt="WEX"
              style={wexLogoStyle}
              data-name="WEX Logo"
            />
          </div>
          <div style={headerActionsStyle}>
            <div className="bank-screen__search">
              <i className="fa-solid fa-magnifying-glass bank-screen__icon" aria-hidden />
              <span className="bank-screen__search-text">Search</span>
            </div>
            <div className="bank-screen__org">
              <i className="fa-solid fa-building bank-screen__icon" aria-hidden />
              <span className="bank-screen__org-name">
                Johnson &amp; Sons Delivery Services (L3)
              </span>
            </div>
            <div className="bank-screen__avatar" aria-hidden>
              <img src={ASSETS.oval} alt="" className="bank-screen__avatar-ring" />
              <span className="bank-screen__avatar-initials">JD</span>
            </div>
          </div>
        </header>

        <div
          className="bank-screen__body"
          data-node-id="1:6834"
          data-name="(D) Bank accounts - Add (US)"
        >
          <aside className="bank-screen__subnav" data-node-id="1:170" data-name="Subnav">
            <div className="bank-screen__subnav-header">
              <div className="bank-screen__subnav-title-row">
                <i className="fa-solid fa-arrow-left bank-screen__icon" aria-hidden />
                <h2 className="bank-screen__subnav-title">Billing &amp; Payments</h2>
              </div>
            </div>
            <nav className="bank-screen__subnav-links" aria-label="Billing section">
              <a href="#credit">Credit overview</a>
              <a href="#statements">Statements</a>
              <a href="#payments">Payments</a>
              <a href="#methods" className="is-active">
                Payment methods
              </a>
            </nav>
          </aside>
          <div className="bank-screen__content" />
        </div>
      </div>

      {createPortal(modalLayer, document.body)}
    </>
  )
}
