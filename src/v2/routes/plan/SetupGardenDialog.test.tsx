import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SetupGardenDialog } from './SetupGardenDialog';

describe('SetupGardenDialog', () => {
  it('requires an explicit operational location and climate before setup completes', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<SetupGardenDialog isOpen onCreate={onCreate} />);

    await user.click(
      screen.getByRole('button', { name: 'Create garden plan' }),
    );
    expect(
      screen.getByText(
        /enter both coordinates before enabling garden operations/i,
      ),
    ).toBeVisible();
    expect(onCreate).not.toHaveBeenCalled();

    await replace(user, 'Location label', 'Back garden');
    await replace(user, 'Weather location description', 'Detroit, MI');
    await replace(user, 'Latitude', '42.3314');
    await replace(user, 'Longitude', '-83.0458');
    await replace(user, 'Garden timezone', 'America/Detroit');
    await replace(user, 'Hardiness zone', '6b');
    await replace(user, 'Typical last frost', '05-05');
    await replace(user, 'Typical first frost', '10-20');
    await user.click(
      screen.getByRole('button', { name: 'Create garden plan' }),
    );

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        climate: {
          firstFrost: '10-20',
          hardinessZone: '6b',
          lastFrost: '05-05',
        },
        location: {
          coordinates: { latitude: 42.3314, longitude: -83.0458 },
          label: 'Back garden',
          query: 'Detroit, MI',
          timezone: 'America/Detroit',
        },
      }),
    );
  });
});

async function replace(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  value: string,
) {
  const field = screen.getByLabelText(new RegExp(`^${label}`));
  await user.clear(field);
  await user.type(field, value);
}
