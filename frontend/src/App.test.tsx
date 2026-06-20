import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { mockCourseApi } from './services/mock';

describe('App', () => {
  it('runs a topic-driven mini-course and shows agent memory', async () => {
    const user = userEvent.setup();
    render(<App api={mockCourseApi} />);

    await user.type(screen.getByLabelText(/topic/i), 'Photosynthesis');
    await user.click(screen.getByRole('button', { name: /start mini-course/i }));

    expect(await screen.findByText(/For Photosynthesis, start with the core idea/i)).toBeInTheDocument();
    expect(screen.getAllByText('What is the key beginner idea in Photosynthesis?').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Planner').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tutor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Quiz Maker').length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText(/learner answer/i), 'not sure');
    await user.click(screen.getByRole('button', { name: /submit to grader/i }));

    expect(await screen.findByText('Wrong')).toBeInTheDocument();
    expect(screen.getAllByText(/core idea of Photosynthesis/i).length).toBeGreaterThan(0);
    const sharedMemory = screen.getByRole('heading', { name: /what all agents know/i }).closest('section');
    expect(sharedMemory).not.toBeNull();
    expect(within(sharedMemory as HTMLElement).getAllByText(/Photosynthesis/i).length).toBeGreaterThan(0);
  });

  it('runs the Newton example and shows weak spot memory', async () => {
    const user = userEvent.setup();
    render(<App api={mockCourseApi} />);

    await user.click(screen.getByRole('button', { name: /try newton example/i }));
    expect(await screen.findByText(/A ball stays still until you kick it — that's inertia/i)).toBeInTheDocument();
    expect(screen.getAllByText('On frictionless ice, does a moving puck slow down on its own?').length).toBeGreaterThan(0);
    expect(screen.getByText('Wrong')).toBeInTheDocument();
    expect(screen.getByText(/Correct answer:/)).toBeInTheDocument();
    expect(screen.getByText('no')).toBeInTheDocument();

    const sharedMemory = screen.getByRole('heading', { name: /what all agents know/i }).closest('section');
    expect(sharedMemory).not.toBeNull();
    expect(within(sharedMemory as HTMLElement).getAllByText(/inertia/i).length).toBeGreaterThan(0);
  });
});
