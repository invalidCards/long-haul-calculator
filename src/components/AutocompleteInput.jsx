import { useId, useMemo, useState } from 'react'

// Native datalists are not reliably tappable on mobile, so suggestions live in
// the page and work equally with a pointer, keyboard, or touch.
export default function AutocompleteInput({ suggestions = [], value, onChange, placeholder, required = false }) {
  const [open, setOpen] = useState(false)
  const listId = useId()
  const matchingSuggestions = useMemo(() => {
    const query = value.trim().toLocaleLowerCase()
    return suggestions.filter((suggestion) => suggestion.toLocaleLowerCase().includes(query)).slice(0, 8)
  }, [suggestions, value])

  return <span className="autocomplete-input">
    <input
      required={required}
      value={value}
      placeholder={placeholder}
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open && matchingSuggestions.length > 0}
      aria-controls={listId}
      onFocus={() => setOpen(true)}
      onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      onChange={(event) => { onChange(event.target.value); setOpen(true) }}
    />
    {open && matchingSuggestions.length > 0 && <span className="autocomplete-options" id={listId} role="listbox">
      {matchingSuggestions.map((suggestion) => <button key={suggestion} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(suggestion); setOpen(false) }}>{suggestion}</button>)}
    </span>}
  </span>
}
