'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Package, Truck, Download, ExternalLink, RefreshCw } from 'lucide-react';
import { money, type ShippingRate } from '@/lib/types';
import { adminRequest, ConfirmAction, Notice } from './controls';
export type AdminShipment = {
  id: string;
  label_url: string | null;
  carrier: string;
  service: string;
  postage_cents: number;
  tracking_code: string | null;
  tracking_url: string | null;
  status: string;
  easypost_shipment_id: string | null;
};
export function OrderActions({
  orderId,
  status,
  total,
  refunded,
  shipments,
}: {
  orderId: string;
  status: string;
  total: number;
  refunded: number;
  shipments: AdminShipment[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [quote, setQuote] = useState<{
    id: string;
    rates: ShippingRate[];
    retry_rate_id?: string;
  } | null>(null);
  const [rateId, setRateId] = useState('');
  const [restock, setRestock] = useState(false);
  const [reason, setReason] = useState('requested_by_customer');
  const [manual, setManual] = useState({ carrier: '', tracking_code: '', tracking_url: '' });
  const canFulfill = ['paid', 'processing'].includes(status) && shipments.length === 0;
  const canRefund = !['pending', 'canceled', 'refunded'].includes(status) && refunded < total;
  const rate = quote?.rates.find((r) => r.id === rateId);
  async function fetchRates() {
    setBusy(true);
    setError('');
    setQuote(null);
    setRateId('');
    try {
      const result = await adminRequest(`orders/${orderId}/rates`, {});
      setQuote({
        id: result.id ?? result.shipment_id ?? result.easypost_shipment_id,
        rates: result.rates,
        retry_rate_id: result.retry_rate_id,
      });
      if (result.retry_rate_id) setRateId(result.retry_rate_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Notice message={error} error />
      <Notice message={notice} />
      <section className="admin-panel">
        <h2>
          <Package size={17} style={{ display: 'inline', marginRight: 8 }} />
          Fulfillment
        </h2>
        {status === 'paid' && (
          <div style={{ marginBottom: 16 }}>
            <ConfirmAction
              label="Start preparing order"
              title="Start preparing this order?"
              description="The order will move to processing. This records the change in its timeline."
              onConfirm={async () => {
                await adminRequest(`orders/${orderId}/processing`, { confirmed: true });
                router.refresh();
              }}
            />
          </div>
        )}
        {shipments.map((s) => (
          <div key={s.id}>
            <p>
              <strong>
                {s.carrier} {s.service}
              </strong>{' '}
              · {s.status}
            </p>
            <p className="muted" style={{ margin: '10px 0' }}>
              {s.tracking_code || 'Tracking pending'}
              {s.postage_cents > 0 ? ` · ${money(s.postage_cents)} postage` : ''}
            </p>
            <div className="admin-actions">
              {s.label_url?.startsWith('https://') && (
                <>
                  <a
                    className="admin-button secondary"
                    href={s.label_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download size={14} />
                    Download / print label
                  </a>
                </>
              )}
              {s.tracking_url?.startsWith('https://') && (
                <a
                  className="admin-button secondary"
                  href={s.tracking_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={14} />
                  Track package
                </a>
              )}
            </div>
            <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
              Open the label to download it or use your browser’s print command.
            </p>
          </div>
        ))}
        {canFulfill && (
          <>
            <p className="muted">
              Compare live carrier prices, then choose a label for this order. The shipment uses the
              customer’s saved address and purchased item weights.
            </p>
            <button
              type="button"
              style={{ margin: '16px 0' }}
              className="admin-button secondary"
              disabled={busy}
              onClick={() => void fetchRates()}
            >
              {busy
                ? 'Finding shipping services…'
                : quote
                  ? 'Refresh shipping rates'
                  : 'Get shipping rates'}
              <RefreshCw size={14} />
            </button>
            {quote && (
              <>
                {quote.retry_rate_id && (
                  <Notice message="A previous label attempt needs reconciliation. Retry the selected service to recover its existing label safely." />
                )}
                <fieldset style={{ border: 0, padding: 0, margin: '0 0 16px' }}>
                  <legend className="muted" style={{ marginBottom: 8 }}>
                    Choose a carrier service
                  </legend>
                  {quote.rates.map((r) => (
                    <label
                      className="admin-check"
                      key={r.id}
                      style={{
                        justifyContent: 'space-between',
                        padding: '10px 0',
                        borderBottom: '1px solid #eceee7',
                      }}
                    >
                      <span>
                        <input
                          type="radio"
                          name="rate"
                          checked={rateId === r.id}
                          disabled={Boolean(quote.retry_rate_id && quote.retry_rate_id !== r.id)}
                          onChange={() => setRateId(r.id)}
                          style={{ marginRight: 8 }}
                        />
                        {r.carrier} · {r.service}
                        <small className="muted" style={{ display: 'block', marginLeft: 25 }}>
                          {r.delivery_days
                            ? `Estimated ${r.delivery_days} business days`
                            : 'Carrier estimate available after dispatch'}
                        </small>
                      </span>
                      <strong>{money(r.amount_cents)}</strong>
                    </label>
                  ))}
                </fieldset>
                {quote.rates.length === 0 ? (
                  <Notice
                    message="No services were returned by the carrier. Check the addresses and retry."
                    error
                  />
                ) : (
                  <ConfirmAction
                    label="Purchase shipping label"
                    title="Purchase this label?"
                    description={
                      rate
                        ? `Purchase ${rate.carrier} ${rate.service} for ${money(rate.amount_cents)}. This creates the shipment and queues a tracking email to your customer.`
                        : 'Choose a shipping service first.'
                    }
                    disabled={!rate || busy}
                    onConfirm={async () => {
                      await adminRequest(`orders/${orderId}/label`, {
                        shipment_id: quote.id,
                        rate_id: rateId,
                        confirmed: true,
                      });
                      setNotice('Shipping label saved. The tracking email has been queued.');
                      setQuote(null);
                      router.refresh();
                    }}
                  />
                )}
              </>
            )}
          </>
        )}
        {!canFulfill && shipments.length === 0 && (
          <p className="muted">Fulfillment is unavailable while this order is {status}.</p>
        )}
      </section>
      {canFulfill && (
        <section className="admin-panel">
          <h2>
            <Truck size={17} style={{ display: 'inline', marginRight: 8 }} />
            Fulfill with your own label
          </h2>
          <p className="muted">
            Already arranged shipping elsewhere? Add its tracking details to update the order and
            email your customer.
          </p>
          <label className="admin-field" style={{ marginTop: 16 }}>
            Carrier
            <input
              value={manual.carrier}
              maxLength={100}
              onChange={(e) => setManual({ ...manual, carrier: e.target.value })}
            />
          </label>
          <label className="admin-field">
            Tracking number
            <input
              value={manual.tracking_code}
              maxLength={150}
              onChange={(e) => setManual({ ...manual, tracking_code: e.target.value })}
            />
          </label>
          <label className="admin-field">
            Tracking link
            <input
              type="url"
              value={manual.tracking_url}
              placeholder="https://…"
              onChange={(e) => setManual({ ...manual, tracking_url: e.target.value })}
            />
          </label>
          <ConfirmAction
            label="Mark as fulfilled"
            title="Mark this order fulfilled?"
            description="The order will be marked shipped and the customer will receive these tracking details."
            disabled={
              !manual.carrier ||
              !manual.tracking_code ||
              !manual.tracking_url.startsWith('https://')
            }
            onConfirm={async () => {
              await adminRequest(`orders/${orderId}/fulfill`, { ...manual, confirmed: true });
              setNotice('Fulfillment recorded. The tracking email has been queued.');
              router.refresh();
            }}
          />
        </section>
      )}
      <section className="admin-panel">
        <h2>Refund payment</h2>
        {canRefund ? (
          <>
            <p className="muted">
              Refund the remaining {money(total - refunded)} through Stripe. Payment status updates
              when Stripe confirms the refund by webhook.
            </p>
            <label className="admin-field" style={{ marginTop: 16 }}>
              Reason
              <select value={reason} onChange={(e) => setReason(e.target.value)}>
                <option value="requested_by_customer">Requested by customer</option>
                <option value="duplicate">Duplicate order</option>
                <option value="fraudulent">Fraudulent payment</option>
              </select>
            </label>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={restock}
                onChange={(e) => setRestock(e.target.checked)}
              />
              Restock all items after confirmed full refund
            </label>
            <p className="muted" style={{ fontSize: 11, marginBottom: 16 }}>
              Only restock items that are still on hand or have been returned in sellable condition.
            </p>
            <ConfirmAction
              danger
              label={`Refund ${money(total - refunded)}`}
              title="Issue this refund?"
              description={`Stripe will return ${money(total - refunded)} to the original payment method. ${restock ? 'All items will be restocked once a full refund is confirmed.' : 'Inventory will stay unchanged.'} Postage is not refunded automatically.`}
              onConfirm={async () => {
                await adminRequest(`orders/${orderId}/refund`, {
                  reason,
                  restock,
                  confirmed: true,
                });
                setNotice(
                  'Refund request submitted to Stripe. The confirmed result will appear in the order timeline.',
                );
                router.refresh();
              }}
            />
          </>
        ) : (
          <p className="muted">
            {status === 'refunded'
              ? 'This order has been fully refunded.'
              : 'There is no refundable payment available.'}
          </p>
        )}
      </section>
    </>
  );
}
