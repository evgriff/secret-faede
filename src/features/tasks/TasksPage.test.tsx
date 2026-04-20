import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderRoute } from '../../test/render';
import { createTestServices } from '../../test/testServices';

describe('TasksPage', () => {
  it('adds a quick manual field task', async () => {
    const user = userEvent.setup();
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app/tasks', services);

    await user.type(await screen.findByLabelText('Task'), 'Check seedlings');
    await user.selectOptions(screen.getByLabelText('Type'), 'inspect');
    await user.click(screen.getByRole('button', { name: 'Add task' }));

    expect(
      await screen.findByRole('heading', { name: 'Check seedlings' }),
    ).toBeVisible();
    expect(screen.getAllByText('Inspect').length).toBeGreaterThan(0);
  });
});
