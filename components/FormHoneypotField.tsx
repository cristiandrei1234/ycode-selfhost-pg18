import { HONEYPOT_FIELD_NAME } from '@/lib/form-spam-settings';

/**
 * Hidden decoy input rendered inside every published form.
 *
 * Positioned off-screen rather than `display: none` because bots skip fields
 * they consider hidden. Untabbable and hidden from assistive tech, so humans
 * never reach it — a filled value means the submission is spam.
 */
export function FormHoneypotField() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '-9999px',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
      }}
    >
      {/* Implicit label association — an id would collide on pages with two forms */}
      <label>
        Leave this field empty
        <input
          type="text"
          name={HONEYPOT_FIELD_NAME}
          tabIndex={-1}
          autoComplete="off"
          defaultValue=""
        />
      </label>
    </div>
  );
}
