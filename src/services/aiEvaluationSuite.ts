import { suggestGroups } from './aiGroupingService';
import { TriageTab } from '../types';

const DUMMY_DATASETS: { name: string; tabs: Partial<TriageTab>[] }[] = [
  {
    name: 'Shopping & Watches',
    tabs: [
      {
        id: 101 as import('../types').TabId,
        title: 'Rolex Submariner Review 2026',
        url: 'https://youtube.com/watch?v=123',
        windowId: 1 as import('../types').WindowId,
        index: 0,
        pinned: false,
      },
      {
        id: 102 as import('../types').TabId,
        title: '10 Best Luxury Watches under $5000',
        url: 'https://gq.com/style/watches',
        windowId: 1 as import('../types').WindowId,
        index: 1,
        pinned: false,
      },
      {
        id: 103 as import('../types').TabId,
        title: 'Buy Rolex Online',
        url: 'https://rolex.com/buy',
        windowId: 1 as import('../types').WindowId,
        index: 2,
        pinned: false,
      },
      {
        id: 104 as import('../types').TabId,
        title: 'Gmail - Inbox',
        url: 'https://mail.google.com/mail/u/0/#inbox',
        windowId: 1 as import('../types').WindowId,
        index: 3,
        pinned: false,
      },
      {
        id: 105 as import('../types').TabId,
        title: 'Order Confirmation - Amazon',
        url: 'https://amazon.com/orders/123',
        windowId: 1 as import('../types').WindowId,
        index: 4,
        pinned: false,
      },
    ],
  },
  {
    name: 'Software Engineering Research',
    tabs: [
      {
        id: 201 as import('../types').TabId,
        title: 'React 19 Hooks - useFormState',
        url: 'https://react.dev/reference/react-dom/hooks/useFormState',
        windowId: 1 as import('../types').WindowId,
        index: 0,
        pinned: false,
      },
      {
        id: 202 as import('../types').TabId,
        title: 'How to fetch data in Next.js 15',
        url: 'https://nextjs.org/docs/app/building-your-application/data-fetching',
        windowId: 1 as import('../types').WindowId,
        index: 1,
        pinned: false,
      },
      {
        id: 203 as import('../types').TabId,
        title:
          'GitHub - facebook/react: A declarative, efficient, and flexible JavaScript library for building user interfaces.',
        url: 'https://github.com/facebook/react',
        windowId: 1 as import('../types').WindowId,
        index: 2,
        pinned: false,
      },
      {
        id: 204 as import('../types').TabId,
        title: 'Cute cat video',
        url: 'https://youtube.com/watch?v=456',
        windowId: 1 as import('../types').WindowId,
        index: 3,
        pinned: false,
      },
      {
        id: 205 as import('../types').TabId,
        title: 'Stack Overflow - Next.js App Router cache not updating',
        url: 'https://stackoverflow.com/questions/123456/next-js-app-router',
        windowId: 1 as import('../types').WindowId,
        index: 4,
        pinned: false,
      },
    ],
  },
];

export async function runAiEvaluation() {
  console.log('=======================================');
  console.log('🚀 Starting AI Grouping Evaluation Suite');
  console.log('=======================================\n');

  let totalLatency = 0;

  for (const dataset of DUMMY_DATASETS) {
    console.log(`[Testing Dataset] ${dataset.name} (${dataset.tabs.length} tabs)`);

    const t0 = performance.now();
    try {
      const results = await suggestGroups(dataset.tabs as TriageTab[], {
        onPhaseChange: (phase: string) => {
          console.log(`   -> Phase: ${phase}`);
        },
      });
      const t1 = performance.now();
      const latency = t1 - t0;
      totalLatency += latency;

      console.log(`✅ Success in ${latency.toFixed(0)}ms`);
      console.log(`Groups Found:`);
      results.forEach((group) => {
        const tabTitles = group.tabs.map((t) => `   - ${t.title}`).join('\n');
        console.log(` 📁 ${group.name}\n${tabTitles}`);
      });
    } catch (err) {
      console.error(`❌ Failed:`, err);
    }
    console.log('\n---------------------------------------\n');
  }

  console.log('=======================================');
  console.log(`🏁 Evaluation Complete. Total Time: ${totalLatency.toFixed(0)}ms`);
  console.log('=======================================');
}

declare global {
  interface Window {
    runAiEvaluation: () => void;
  }
}

// Attach to window for easy access in dev tools
if (typeof window !== 'undefined') {
  window.runAiEvaluation = runAiEvaluation;
}
