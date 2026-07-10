import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { Modal, type OverlayCloseReason } from './Modal';

function ModalHarness({
  onCloseReason,
}: {
  onCloseReason(reason: OverlayCloseReason): void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div data-testid="background">
      <button onClick={() => setOpen(true)} type="button">
        Open editor
      </button>
      <Modal
        footer={<button type="button">Save changes</button>}
        isOpen={open}
        onClose={(reason) => {
          onCloseReason(reason);
          setOpen(false);
        }}
        title="Edit tomatoes"
      >
        <label>
          Notes
          <input />
        </label>
      </Modal>
    </div>
  );
}

describe('Modal', () => {
  it('isolates the background, traps focus, closes with Escape, and restores focus', async () => {
    const user = userEvent.setup();
    const onCloseReason = vi.fn();
    render(<ModalHarness onCloseReason={onCloseReason} />);
    const trigger = screen.getByRole('button', { name: 'Open editor' });

    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Edit tomatoes' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Close Edit tomatoes' }),
      ).toHaveFocus(),
    );
    expect(
      trigger.closest('[data-testid="background"]')?.parentElement,
    ).toHaveAttribute('aria-hidden', 'true');

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Save changes' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(onCloseReason).toHaveBeenCalledWith('escape');
    expect(trigger).toHaveFocus();
    expect(
      trigger.closest('[data-testid="background"]')?.parentElement,
    ).not.toHaveAttribute('aria-hidden');
  });
});
