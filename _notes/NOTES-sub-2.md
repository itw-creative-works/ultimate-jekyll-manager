    // Flags for special conditions
    flags: {
      hasDispute: false,
      hasRefund: false,
      isDelinquent: false,
      requiresAction: false,
      autoRenewEnabled: true,
      cancellationRequested: false,
    },

    // Dispute information (if applicable)
    dispute: {
      active: false,
      createdAt: timestamp,
      amount: 99.99,
      reason: "fraudulent",
      status: "warning_needs_response",
      dueBy: timestamp,
      evidence: {
        submitted: false,
        documents: []
      }
    },

    // Refund information (if applicable)
    refunds: [
      {
        id: "refund-xxx",
        amount: 99.99,
        reason: "customer_request",
        createdAt: timestamp,
        metadata: {}
      }
    ],

    // Cancellation details (if cancelled)
    cancellation: {
      requestedAt: timestamp,
      effectiveAt: timestamp, // When it actually ends
      reason: "too_expensive",
      feedback: "Price increased too much",
    },
