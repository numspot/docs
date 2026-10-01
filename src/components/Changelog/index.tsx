import React, { useMemo, useState } from 'react';
import { translate } from "@docusaurus/Translate";

enum Status {
    Added = 'added',
    Changed = 'changed',
    Deprecated = 'deprecated',
    Fixed = 'fixed',
    Removed = 'removed',
    Security = 'security'
}

type ChangelogEntry = {
    service: string
    status: Status,
    date: string,
    title: string,
    description: string,
    components: string[]
}

type Changelog = {
    entries: ChangelogEntry[]
}

/**
 * Make first character of a string capitalized
 * @param str A string
 * @returns The string with a capitalized first character
 */
const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

/**
 * French labels for status tags
 */
const STATUS_LABELS: Record<Status, string> = {
    [Status.Added]: translate({ id: "changelog.status.added", message: "Added" }),
    [Status.Changed]: translate({ id: "changelog.status.changed", message: "Changed" }),
    [Status.Deprecated]: translate({ id: "changelog.status.deprecated", message: "Deprecated" }),
    [Status.Fixed]: translate({ id: "changelog.status.fixed", message: "Fixed" }),
    [Status.Removed]: translate({ id: "changelog.status.removed", message: "Removed" }),
    [Status.Security]: translate({ id: "changelog.status.security", message: "Security" }),
}

/**
 * Service display labels (FR → localised). Only services whose name differs in
 * English need an entry; others fall through to the raw value. The canonical
 * (French) service name in changelog.json is the lookup key; see also the
 * glossary, which documents the same FR→EN correspondence.
 */
const SERVICE_LABELS: Record<string, string> = {
    "Connectivité": translate({ id: "changelog.service.connectivity", message: "Connectivity" }),
    "Inventaire": translate({ id: "changelog.service.inventory", message: "Inventory" }),
    "Services Managés": translate({ id: "changelog.service.managed-services", message: "Managed Services" }),
    "Plateforme IA Mistral": translate({ id: "changelog.service.mistral-ai-platform", message: "Mistral AI Platform" }),
}

const serviceLabel = (service: string) => SERVICE_LABELS[service] ?? service

/**
 * Display order for statuses (used in the filter panel)
 */
const STATUS_ORDER: Status[] = [
    Status.Added, Status.Changed, Status.Deprecated,
    Status.Fixed, Status.Removed, Status.Security,
]

/**
 * Generate the status tag
 * @param entryStatus
 * @returns div of the tag with the status
 */
const generateTag = (entryStatus: Status) => {
    return (<div className={`subtitle-xs tag tag-${entryStatus}`}>{STATUS_LABELS[entryStatus] ?? capitalize(entryStatus)}</div>)
}

/**
 * Get month in text based on a Date instance (Example: "Juin 2025")
 * @param date A Date instance
 * @returns The month with the year
 */
const getMonthAndYear = (date: Date) => {
    const months = [
        translate({ id: "changelog.month.1", message: "January" }),
        translate({ id: "changelog.month.2", message: "February" }),
        translate({ id: "changelog.month.3", message: "March" }),
        translate({ id: "changelog.month.4", message: "April" }),
        translate({ id: "changelog.month.5", message: "May" }),
        translate({ id: "changelog.month.6", message: "June" }),
        translate({ id: "changelog.month.7", message: "July" }),
        translate({ id: "changelog.month.8", message: "August" }),
        translate({ id: "changelog.month.9", message: "September" }),
        translate({ id: "changelog.month.10", message: "October" }),
        translate({ id: "changelog.month.11", message: "November" }),
        translate({ id: "changelog.month.12", message: "December" }),
    ];

    const month = months[date.getMonth()]
    const year = date.getFullYear()

    return `${month} ${year}`
}

/**
 * Returns an array with key/value as "Month Year" => changelog entries of this month
 * @param entries The entries of a month
 * @returns The entries grouped by month
 */
export const groupByMonth = (entries: ChangelogEntry[]) => {
    // TODO use Object.groupBy when node 22 is used for the public docs
    //return Object.groupBy(entries, (entry: ChangelogEntry) => getMonthAndYear(new Date(entry.date)))

    return entries.reduce((acc, entry) => {
        let groupKey = getMonthAndYear(new Date(entry.date))

        if (!acc[groupKey]) {
            acc[groupKey] = []
        }

        acc[groupKey].push(entry)

        return acc;
    }, {})
}

/**
 * Returns an array with key/value as "ServiceName" => changelog entries of this service
 * @param entries The entries of a service
 * @returns The entries grouped by service
 */
const groupByService = (entries: ChangelogEntry[]) => {
    // TODO use Object.groupBy when node 22 is used for the public docs
    // return Object.groupBy(entries, entry => entry.service)

    return entries.reduce((acc, entry) => {
        let groupKey = entry['service']

        if (!acc[groupKey]) {
            acc[groupKey] = []
        }

        acc[groupKey].push(entry)

        return acc;
    }, {});
}

/**
 * Generates the entry (status, title and description)
 * @param entry The entry
 * @returns
 */
const generateEntry = (entry: ChangelogEntry, key: string) => {
    return <div key={key} className='changelog-entry'>
        {generateTag(entry.status)} <span className="changelog-entry-title title-sm">{entry.title}</span>
        <div className="changelog-entry-description body-sm">{entry.description}</div>
    </div>
}

/**
 * Generate all entries separated by service
 * @param month The month
 * @param entries The entries of this month
 * @returns
 */
const generateEntriesByService = (month: string, entries: ChangelogEntry[]) => {
    const entriesByService = groupByService(entries)

    return Object.keys(entriesByService).map(service => (
        <div key={`${month}-${service}`} className='changelog-service-entries'>
            <div className="changelog-service title-md">{serviceLabel(service)}</div>

            {entriesByService[service].map((entry, index) =>
                generateEntry(entry, `${month}-${service}-${index}`)
            )}
        </div>
    ))
}

/**
 * Chevron icon used to collapse/expand a filter section
 */
const Chevron = ({ open }: { open: boolean }) => (
    <svg
        className={`changelog-filter-chevron${open ? '' : ' is-collapsed'}`}
        width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
    >
        <polyline points="6 9 12 15 18 9" />
    </svg>
)

type FilterSectionProps = {
    title: string,
    children: React.ReactNode,
}

/**
 * A collapsible section in the filter panel
 */
const FilterSection = ({ title, children }: FilterSectionProps) => {
    const [open, setOpen] = useState(true)

    return (
        <div className="changelog-filter-section">
            <button
                type="button"
                className="changelog-filter-section-header body-sm"
                aria-expanded={open}
                onClick={() => setOpen(prev => !prev)}
            >
                <span>{title}</span>
                <Chevron open={open} />
            </button>
            {open && <div className="changelog-filter-options">{children}</div>}
        </div>
    )
}

type FilterOptionProps = {
    checked: boolean,
    onChange: () => void,
    children: React.ReactNode,
}

/**
 * A single checkbox row in the filter panel
 */
const FilterOption = ({ checked, onChange, children }: FilterOptionProps) => (
    <label className="changelog-filter-option">
        <input
            type="checkbox"
            className="changelog-filter-checkbox-input"
            checked={checked}
            onChange={onChange}
        />
        <span className="changelog-filter-checkbox" aria-hidden="true" />
        {children}
    </label>
)

/**
 * Toggle a value inside a Set, returning a new Set
 */
const toggleInSet = (set: Set<string>, value: string) => {
    const next = new Set(set)
    if (next.has(value)) {
        next.delete(value)
    } else {
        next.add(value)
    }
    return next
}

type ChangelogProps = {
    changelog: Changelog
}

export default function Changelog({ changelog }: Readonly<ChangelogProps>) {
    // sort all entries by month (most recent first)
    // TODO use toSorted when node 22 is used for the public docs
    const entries = [...changelog.entries].sort(function (a, b) {
        return (new Date(b.date)).getTime() - (new Date(a.date).getTime())
    })

    const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set())
    const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set())

    // distinct statuses present in the data, kept in canonical display order
    const availableStatuses = useMemo(() => {
        const present = new Set(entries.map(e => e.status))
        return STATUS_ORDER.filter(status => present.has(status))
    }, [entries])

    // distinct services present in the data, alphabetically sorted
    const availableServices = useMemo(() => {
        return Array.from(new Set(entries.map(e => e.service))).sort((a, b) => a.localeCompare(b, 'fr'))
    }, [entries])

    // apply the active filters: an entry passes when it matches every active dimension
    const filteredEntries = useMemo(() => entries.filter(entry => {
        const statusOk = selectedStatuses.size === 0 || selectedStatuses.has(entry.status)
        const serviceOk = selectedServices.size === 0 || selectedServices.has(entry.service)
        return statusOk && serviceOk
    }), [entries, selectedStatuses, selectedServices])

    const entriesByMonth = groupByMonth(filteredEntries)
    const activeCount = selectedStatuses.size + selectedServices.size

    const latestEntry = entries[0]
    const latestDate = latestEntry ? new Date(latestEntry.date) : null
    const lastUpdateLabel = latestDate
        ? translate(
            { id: "changelog.lastUpdate", message: "Last updated on {day} {monthYear}" },
            { day: latestDate.getDate(), monthYear: getMonthAndYear(latestDate) },
        )
        : ""

    const resetFilters = () => {
        setSelectedStatuses(new Set())
        setSelectedServices(new Set())
    }

    return (
        <div className="changelog-layout">
            <div className="changelog">
                <div className='changelog-intro'>
                    <div className="changelog-title body-lg">{translate({ id: "changelog.intro", message: "Discover the latest changes to Numspot products and features." })}</div>
                    {lastUpdateLabel && <div className="changelog-last-update body-sm">{lastUpdateLabel}</div>}
                </div>

                {Object.keys(entriesByMonth).length === 0 ? (
                    <div className="changelog-empty body-sm">{translate({ id: "changelog.empty", message: "No entry matches the selected filters." })}</div>
                ) : (
                    Object.keys(entriesByMonth).map(month => (
                        <div key={month} className='changelog-month-entries'>
                            <div className="changelog-month title-lg">{month}</div>
                            {generateEntriesByService(month, entriesByMonth[month])}
                        </div>
                    ))
                )}
            </div>

            <aside className="changelog-filters" aria-label={translate({ id: "changelog.filters.aria", message: "Changelog filters" })}>
                <div className="changelog-filters-header">
                    <span className="changelog-filters-title subtitle-sm">{translate({ id: "changelog.filters.title", message: "Filters" })}</span>
                    <button
                        type="button"
                        className="changelog-filter-count caption-sm"
                        onClick={resetFilters}
                        disabled={activeCount === 0}
                        title={activeCount > 0 ? translate({ id: "changelog.filters.reset", message: "Reset filters" }) : undefined}
                    >
                        {activeCount}
                    </button>
                </div>

                <FilterSection title={translate({ id: "changelog.filters.status", message: "Status" })}>
                    {availableStatuses.map(status => (
                        <FilterOption
                            key={status}
                            checked={selectedStatuses.has(status)}
                            onChange={() => setSelectedStatuses(prev => toggleInSet(prev, status))}
                        >
                            {generateTag(status)}
                        </FilterOption>
                    ))}
                </FilterSection>

                <FilterSection title={translate({ id: "changelog.filters.service", message: "Service" })}>
                    {availableServices.map(service => (
                        <FilterOption
                            key={service}
                            checked={selectedServices.has(service)}
                            onChange={() => setSelectedServices(prev => toggleInSet(prev, service))}
                        >
                            <span className="changelog-filter-label body-sm">{serviceLabel(service)}</span>
                        </FilterOption>
                    ))}
                </FilterSection>
            </aside>
        </div>)
}
