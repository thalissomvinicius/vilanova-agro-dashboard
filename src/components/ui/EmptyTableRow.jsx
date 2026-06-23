import React from 'react';

export default function EmptyTableRow({ children, className = '', colSpan, message }) {
  return (
    <tr>
      <td colSpan={colSpan} className={`empty-table-cell ${className}`.trim()}>
        {children || message}
      </td>
    </tr>
  );
}
