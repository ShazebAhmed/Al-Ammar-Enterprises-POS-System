"use client";
import { useMemo, useState } from "react";
import Icon from "@/components/Icon";
import StatCard from "@/components/admin/StatCard";
import { formatMoney } from "@/lib/format";
import {
  dailyReport,
  monthlyReport,
  pkDay,
  reportCsv,
  reportLabel,
  reportYears,
} from "@/lib/reports";

function download(name, text) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// Sales by month for a year, and by day for a month. Sales count delivered
// (cash on delivery received) orders only; see lib/reports.js.
export default function ReportsTab({ orders, settings, costOf }) {
  const years = useMemo(() => reportYears(orders), [orders]);
  const [year, setYear] = useState(years[0]);
  const [month, setMonth] = useState("");
  const money = (n) => formatMoney(n, settings.currencySymbol);
  const today = pkDay(new Date());
  const report = useMemo(
    () =>
      month
        ? dailyReport(orders, month, costOf)
        : monthlyReport(orders, year, costOf),
    [orders, year, month, costOf],
  );
  // Months up to this one; days that had orders.
  const rows = month
    ? report.rows.filter((r) => r.orders > 0)
    : report.rows.filter((r) => r.key <= today.slice(0, 7));
  const title = month ? reportLabel(month) : String(year);
  return (
    <div>
      <div className="report-head">
        {month ? (
          <button className="text-button" onClick={() => setMonth("")}>
            <Icon name="chevron_left" size={16} /> All of {year}
          </button>
        ) : (
          <label className="sort-field">
            <span>Year</span>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="Year"
            >
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
        )}
        <button
          className="stx-btn stx-btn-outline"
          onClick={() =>
            download(
              `AlAmmar-sales-${month || year}.csv`,
              reportCsv(rows, report.total),
            )
          }
        >
          <Icon name="download" size={16} /> Export CSV
        </button>
      </div>
      <h2 className="report-title">{title}</h2>
      <div className="admin-stats">
        <StatCard
          icon="account_balance_wallet"
          label="Sales"
          value={money(report.total.sales)}
          caption={`${report.total.delivered} delivered · order value, not profit`}
          accent
        />
        <StatCard
          icon="list_alt"
          label="Orders placed"
          value={report.total.orders}
          caption={`${report.total.cancelled} cancelled`}
        />
        <StatCard
          icon="local_shipping"
          label="In progress"
          value={money(report.total.inProgressValue)}
          caption={`${report.total.inProgress} orders not delivered yet`}
        />
        <StatCard
          icon="bar_chart"
          label="Profit"
          value={money(report.total.profit)}
          caption={`Goods cost ${money(report.total.cost)} · discounts ${money(report.total.discounts)}`}
        />
      </div>
      <section className="stx-card">
        <div className="admin-table-wrap">
          <table className="admin-table report-table">
            <thead>
              <tr>
                <th>{month ? "Day" : "Month"}</th>
                <th>Orders</th>
                <th>Delivered</th>
                <th>Cancelled</th>
                <th>Sales</th>
                <th>Delivery</th>
                <th>Discounts</th>
                <th>Cost of goods</th>
                <th>Profit</th>
                <th>In progress</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>
                    {month ? (
                      reportLabel(r.key)
                    ) : (
                      <button
                        className="text-button"
                        onClick={() => setMonth(r.key)}
                        aria-label={`Daily report for ${reportLabel(r.key)}`}
                      >
                        {reportLabel(r.key)}
                      </button>
                    )}
                  </td>
                  <td>{r.orders}</td>
                  <td>{r.delivered}</td>
                  <td>{r.cancelled}</td>
                  <td>
                    <strong>{money(r.sales)}</strong>
                  </td>
                  <td>{money(r.delivery)}</td>
                  <td>{money(r.discounts)}</td>
                  <td>{money(r.cost)}</td>
                  <td>
                    <strong>{money(r.profit)}</strong>
                  </td>
                  <td>{money(r.inProgressValue)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr>
                  <td colSpan={10} className="muted">
                    No orders in this period.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>{report.total.orders}</td>
                  <td>{report.total.delivered}</td>
                  <td>{report.total.cancelled}</td>
                  <td>{money(report.total.sales)}</td>
                  <td>{money(report.total.delivery)}</td>
                  <td>{money(report.total.discounts)}</td>
                  <td>{money(report.total.cost)}</td>
                  <td>{money(report.total.profit)}</td>
                  <td>{money(report.total.inProgressValue)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>
      {report.total.costMissing > 0 && (
        <p className="inline-error" role="status">
          {report.total.costMissing} delivered{" "}
          {report.total.costMissing === 1 ? "item has" : "items have"} no cost
          price, so profit here is too high. Add a cost price to those products
          (Products → Edit).
        </p>
      )}
      <p className="chart-note">
        {month
          ? "Days with orders, by order date in Pakistan time."
          : "Tap a month to see its days."}{" "}
        Sales are delivered orders only (cash received); in progress orders
        count once delivered. Profit = sales without delivery charges, minus the
        cost price of the goods (the cost saved when each order was placed).
      </p>
    </div>
  );
}
