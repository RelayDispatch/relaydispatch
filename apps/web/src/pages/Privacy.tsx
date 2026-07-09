import React from 'react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-surface-primary text-ink-primary flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-ink-secondary text-lg mb-6">
          RelayDispatch is open-source, self-hosted software. We do not collect or
          process any personal data on behalf of operators or their end users.
        </p>
        <p className="text-ink-tertiary mb-4">
          When you self-host RelayDispatch, all data stays within your own
          infrastructure. You are the data controller for any personal information
          processed by your deployment.
        </p>
        <p className="text-ink-tertiary">
          If you are using a hosted deployment of RelayDispatch, please refer to the
          privacy policy provided by the operator of that instance.
        </p>
        <p className="mt-6 text-ink-tertiary text-sm">
          For questions about the open-source project, please open an issue on{' '}
          <a
            href="https://github.com/relaydispatch/relaydispatch"
            className="text-accent-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          .
        </p>
      </div>
    </div>
  );
}
