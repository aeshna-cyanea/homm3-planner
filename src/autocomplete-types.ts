export interface AutoCompleteResult<T> {
  match: string;
  value: T;
  key?: string;
}

export interface AutoCompleteFeedback<T> {
  query: string;
  results: AutoCompleteResult<T>[];
  selection?: AutoCompleteResult<T> & { index: number };
}

export interface AutoCompleteInstance<T> {
  input: HTMLInputElement;
  list: HTMLElement;
  cursor: number;
  isOpen: boolean;
  submit: boolean;
  feedback: AutoCompleteFeedback<T>;
  resultItem: { id: string };
  resultsList: { tabSelect: boolean };
  goTo(index: number): void;
  next(): void;
  previous(): void;
  select(index?: number): void;
  close(): void;
  unInit(): void;
}

interface InputEvents<T> {
  selection?: (event: CustomEvent<AutoCompleteFeedback<T>>) => void;
  keydown?: (event: KeyboardEvent) => void;
  open?: (event: CustomEvent<AutoCompleteFeedback<T>>) => void;
  close?: (event: CustomEvent<AutoCompleteFeedback<T>>) => void;
}

export interface AutoCompleteConfig<T> {
  selector: () => HTMLInputElement;
  data: {
    src: T[];
    keys: (keyof T & string)[];
    cache?: boolean;
  };
  threshold?: number;
  resultsList?: {
    class?: string;
    maxResults?: number;
    noResults?: boolean;
    element?: (
      list: HTMLElement,
      feedback: AutoCompleteFeedback<T>,
    ) => void;
  };
  resultItem?: {
    id?: string;
    class?: string;
    selected?: string;
    element?: (
      item: HTMLElement,
      result: AutoCompleteResult<T>,
    ) => void;
  };
  events?: {
    input?: InputEvents<T>;
  };
}
