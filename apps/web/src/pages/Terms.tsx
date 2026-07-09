import React from 'react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-surface-primary text-ink-primary flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-3xl font-bold mb-4">Terms of Service</h1>
        <p className="text-ink-secondary text-lg mb-6">
          RelayDispatch is open-source software licensed under the MIT License.
        </p>
        <p className="text-ink-tertiary">
          By deploying and using this software, you agree to the terms of the{' '}
          <a
            href="https://github.com/relaydispatch/relaydispatch/blob/main/LICENSE"
            className="text-accent-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            MIT License
          </a>
          .
        </p>
        <p className="mt-4 text-ink-tertiary text-sm">
          If you are running a hosted version of RelayDispatch, the operator of that
          instance is responsible for providing their own Terms of Service.
        </p>
      </div>
    </div>
  );
}
