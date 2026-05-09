import { suggestGroups } from './aiGroupingService';

const DUMMY_DATASETS = [
    {
        name: "Shopping & Watches",
        tabs: [
            { id: 101, title: "Rolex Submariner Review 2026", url: "https://youtube.com/watch?v=123", windowId: 1, index: 0, pinned: false },
            { id: 102, title: "10 Best Luxury Watches under $5000", url: "https://gq.com/style/watches", windowId: 1, index: 1, pinned: false },
            { id: 103, title: "Buy Rolex Online", url: "https://rolex.com/buy", windowId: 1, index: 2, pinned: false },
            { id: 104, title: "Gmail - Inbox", url: "https://mail.google.com/mail/u/0/#inbox", windowId: 1, index: 3, pinned: false },
            { id: 105, title: "Order Confirmation - Amazon", url: "https://amazon.com/orders/123", windowId: 1, index: 4, pinned: false },
        ]
    },
    {
        name: "Software Engineering Research",
        tabs: [
            { id: 201, title: "React 19 Hooks - useFormState", url: "https://react.dev/reference/react-dom/hooks/useFormState", windowId: 1, index: 0, pinned: false },
            { id: 202, title: "How to fetch data in Next.js 15", url: "https://nextjs.org/docs/app/building-your-application/data-fetching", windowId: 1, index: 1, pinned: false },
            { id: 203, title: "GitHub - facebook/react: A declarative, efficient, and flexible JavaScript library for building user interfaces.", url: "https://github.com/facebook/react", windowId: 1, index: 2, pinned: false },
            { id: 204, title: "Cute cat video", url: "https://youtube.com/watch?v=456", windowId: 1, index: 3, pinned: false },
            { id: 205, title: "Stack Overflow - Next.js App Router cache not updating", url: "https://stackoverflow.com/questions/123456/next-js-app-router", windowId: 1, index: 4, pinned: false },
        ]
    }
];

export async function runAiEvaluation() {
    console.log("=======================================");
    console.log("🚀 Starting AI Grouping Evaluation Suite");
    console.log("=======================================\n");

    let totalLatency = 0;

    for (const dataset of DUMMY_DATASETS) {
        console.log(`[Testing Dataset] ${dataset.name} (${dataset.tabs.length} tabs)`);
        
        const t0 = performance.now();
        try {
            let currentPhase = '';
            const results = await suggestGroups(dataset.tabs, {
                onPhaseChange: (phase) => {
                    currentPhase = phase;
                    console.log(`   -> Phase: ${phase}`);
                }
            });
            const t1 = performance.now();
            const latency = t1 - t0;
            totalLatency += latency;

            console.log(`✅ Success in ${latency.toFixed(0)}ms`);
            console.log(`Groups Found:`);
            results.forEach(group => {
                const tabTitles = group.tabs.map(t => `   - ${t.title}`).join('\n');
                console.log(` 📁 ${group.name}\n${tabTitles}`);
            });
        } catch (err) {
            console.error(`❌ Failed:`, err);
        }
        console.log("\n---------------------------------------\n");
    }

    console.log("=======================================");
    console.log(`🏁 Evaluation Complete. Total Time: ${totalLatency.toFixed(0)}ms`);
    console.log("=======================================");
}

// Attach to window for easy access in dev tools
if (typeof window !== 'undefined') {
    window.runAiEvaluation = runAiEvaluation;
}
