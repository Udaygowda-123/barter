'use client';
import { usePathname } from 'next/navigation';
import { ConversationList } from '@/components/chat/conversation-list';
import { Spinner } from '@/components/ui/states';
import { useRequireAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  const { status } = useRequireAuth(); const inThread = usePathname() !== '/messages';
  if (status !== 'authed') return <Spinner />;
  return (
    <div className="grid h-[calc(100dvh-10rem)] min-h-[28rem] overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)] md:h-[calc(100dvh-9rem)] md:grid-cols-[22rem_1fr]">
      <aside aria-label="Conversation list" className={cn('overflow-y-auto border-r border-line', inThread ? 'hidden md:block' : 'block')}>
        <h1 className="sticky top-0 z-10 border-b border-line bg-surface/95 px-4 py-4 text-2xl font-black backdrop-blur">Messages</h1><ConversationList />
      </aside>
      <section className={cn('min-h-0', inThread ? 'block' : 'hidden md:block')}>{children}</section>
    </div>
  );
}
