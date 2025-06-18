import { useCallback, useEffect, useRef } from 'react';

export default function useBroadcastChannel(channelName, handlers = {}) {
  const { onMove, onUndo, onJump, onCustom } = handlers;
  const channelRef = useRef(null);
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    if (!('BroadcastChannel' in window)) {
      console.warn('BroadcastChannel API not supported');
      return undefined;
    }
    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;
    channel.onmessage = (event) => {
      const { type, payload, senderId } = event.data || {};
      if (senderId === instanceIdRef.current) return;
      switch (type) {
        case 'move':
          onMove?.(payload);
          break;
        case 'undo':
          onUndo?.();
          break;
        case 'jump':
          onJump?.(payload);
          break;
        default:
          onCustom?.({ type, payload, senderId });
      }
    };
    return () => {
      channelRef.current = null;
      channel.close();
    };
  }, [channelName, onMove, onUndo, onJump, onCustom]);

  const post = useCallback((type, payload) => {
    if (!channelRef.current) return;
    channelRef.current.postMessage({
      type,
      payload,
      timestamp: Date.now(),
      senderId: instanceIdRef.current,
    });
  }, []);

  const sendMove = useCallback((payload) => post('move', payload), [post]);
  const sendUndo = useCallback(() => post('undo'), [post]);
  const sendJump = useCallback((payload) => post('jump', payload), [post]);
  const sendCustom = useCallback((type, payload) => post(type, payload), [post]);
  const closeChannel = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.close();
      channelRef.current = null;
    }
  }, []);

  return { sendMove, sendUndo, sendJump, sendCustom, closeChannel };
}