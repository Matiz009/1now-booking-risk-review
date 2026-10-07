import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useToasts } from './useToasts';

describe('useToasts', () => {
  it('adds toasts with different messages side by side', () => {
    const { result } = renderHook(() => useToasts());

    act(() => {
      result.current.showToast('success', 'Booking BK-1001 approved.');
      result.current.showToast('error', 'Couldn’t decline BK-1007. Change reverted.');
    });

    expect(result.current.toasts.map((toast) => toast.message)).toEqual([
      'Booking BK-1001 approved.',
      'Couldn’t decline BK-1007. Change reverted.',
    ]);
  });

  it('replaces a toast with the same message instead of stacking a duplicate', () => {
    const { result } = renderHook(() => useToasts());

    act(() => {
      result.current.showToast('info', 'Same message');
    });
    const firstId = result.current.toasts[0]?.id;
    act(() => {
      result.current.showToast('info', 'Same message');
    });

    expect(result.current.toasts).toHaveLength(1);
    // A new id remounts the toast, so its timer starts again from full.
    expect(result.current.toasts[0]?.id).not.toBe(firstId);
  });

  it('removes a toast by id', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.showToast('info', 'Bye');
    });

    act(() => {
      result.current.dismissToast(result.current.toasts[0]!.id);
    });

    expect(result.current.toasts).toEqual([]);
  });

  it('removes every toast of one tone and keeps the rest', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.showToast('success', 'BK-1001 approved.');
      result.current.showToast('error', 'Couldn’t approve BK-1002. Change reverted.');
      result.current.showToast('success', 'BK-1003 declined.');
    });

    act(() => {
      result.current.dismissTone('success');
    });

    expect(result.current.toasts.map((toast) => toast.message)).toEqual([
      'Couldn’t approve BK-1002. Change reverted.',
    ]);
  });
});
