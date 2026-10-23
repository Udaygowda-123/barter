import { MessageCircle } from 'lucide-react';

export default function MessagesIndex() {
  return <div className="flex h-full flex-col items-center justify-center p-8 text-center text-muted"><MessageCircle className="mb-3 size-10" aria-hidden /><p className="font-semibold text-ink">Select a conversation</p><p className="text-sm">Offers, counteroffers and chat live together here.</p></div>;
}
