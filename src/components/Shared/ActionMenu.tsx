import React from 'react';
import styles from './ActionMenu.module.css';
import { IconProps } from '@phosphor-icons/react';

export interface ActionMenuItemProps {
  key?: string | number;
  label: string;
  icon: React.ElementType<IconProps>;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  className?: string;
  iconClassName?: string;
}

export interface ActionMenuSection {
  title?: string;
  key?: string | number;
  items: ActionMenuItemProps[];
}

export interface ActionMenuProps {
  items?: ActionMenuItemProps[];
  sections?: ActionMenuSection[];
}

export default function ActionMenu({ items, sections }: ActionMenuProps) {
  if (items) {
    return (
      <>
        {items.map((item, i) => (
          <ActionMenuItem key={item.key ?? i} item={item} />
        ))}
      </>
    );
  }

  if (!sections) return null;

  return (
    <>
      {sections.map((section, i) => (
        <React.Fragment key={section.key ?? section.title ?? i}>
          {section.title && <div className={styles.sectionLabel}>{section.title}</div>}
          {section.items.map((item, j) => (
            <ActionMenuItem key={item.key ?? j} item={item} />
          ))}
          {i < sections.length - 1 && <div className={styles.sectionDivider} />}
        </React.Fragment>
      ))}
    </>
  );
}

function ActionMenuItem({ item }: { item: ActionMenuItemProps }) {
  const Icon = item.icon;
  return (
    <button className={item.className} onClick={item.onClick}>
      <Icon size={20} weight="duotone" className={item.iconClassName || ''} />
      <span>{item.label}</span>
    </button>
  );
}
