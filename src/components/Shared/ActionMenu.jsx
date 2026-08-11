import React from 'react';
import styles from './ActionMenu.module.css';

export default function ActionMenu({ items, sections }) {
  if (items) {
    return items.map((item, i) => (
      <ActionMenuItem key={item.key ?? i} item={item} />
    ));
  }

  return sections.map((section, i) => (
    <React.Fragment key={section.key ?? section.title ?? i}>
      {section.title && <div className={styles.sectionLabel}>{section.title}</div>}
      {section.items.map((item, j) => (
        <ActionMenuItem key={item.key ?? j} item={item} />
      ))}
      {i < sections.length - 1 && <div className={styles.sectionDivider} />}
    </React.Fragment>
  ));
}

function ActionMenuItem({ item }) {
  const Icon = item.icon;
  return (
    <button className={item.className} onClick={item.onClick}>
      <Icon size={20} weight="duotone" className={item.iconClassName || ''} />
      <span>{item.label}</span>
    </button>
  );
}
