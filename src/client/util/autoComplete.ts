import { Exclude } from 'class-transformer'
import * as $ from "jquery"
import { debounce } from 'lodash-decorators'
import { Component, HProps, HValue, KeyValue, commandButton, commandLink, div, inputText, isNullOrEmpty, span, key, Let } from 'pickle-ts'
import { icon, transient } from '../util/util'
import { style } from 'typestyle'

interface IAutoCompleteProps
{
    isMultiSelect : boolean
    suggestionLimit: number
    isRealtime: boolean
    isSuggestion: boolean
    autoFilter: boolean
    showNoResultsFound: boolean
    autoSelectSingleResult: boolean
    allowNonSuggestions: boolean
    preload: boolean
    looseMatch: boolean
    suggestor?: (searchText: string) => Promise<string[]>
    labelToModel?: (label: string) => string
    modelToLabel?: (val: string) => string
    onSelectEvent?: (selection: string | string[]) => void    
}

export type AutoCompleteProps = Partial<IAutoCompleteProps>

@Exclude()
export class AutoComplete extends Component implements AutoCompleteProps
{    
    readonly isMultiSelect = false
    readonly suggestionLimit = 10
    readonly isRealtime = true    
    readonly autoFilter = true    
    readonly showNoResultsFound = false
    readonly autoSelectSingleResult = false    
    readonly allowNonSuggestions = false    
    readonly preload = false
    looseMatch = false
    readonly suggestor?: (searchText: string) => Promise<string[]>        
    readonly _toModel?: (selection: string | string[]) => void
    readonly _fromModel?: () => string | string[]   

    onSelectEvent?: (selection: string | string[]) => void    

    selections: string[] = []    
    searchText?: string = undefined
    suggestions: string[] = []

    isSuggestion = false
    private attemptedAutoComplete = false
    private enterKeySelection = false
    private transitioningFocus = false
    private static idCount = 0
    private id!: string

    constructor (parent: Component, prop: () => any, props: AutoCompleteProps = {}) {        
        super()        
            
        Object.keys (props)
            .filter(k => props[k] !== undefined)
            .forEach(k => this[k] = props[k])
        
        this._toModel = async selection => parent[key(prop)] =
            mapSingleOrMultiple (this.isMultiSelect, selection, x => props.labelToModel ? props.labelToModel (x) : x)
        
        this._fromModel = () =>
            mapSingleOrMultiple (this.isMultiSelect, parent[key(prop)], x => props.modelToLabel ? props.modelToLabel (x) : x)        
    }
                           
    private handleClickOutside() {
        $(document).click (e => {
            let ac = document.getElementById (this.id)
            if (ac == null)
                return

            if (! ac.parentElement!.contains (e.target) && this.isSuggestionsVisible())
                this.closeSuggestions()
        })        
    }

    async attached (deserialized: boolean)
    {
        this.id = "autoComplete" + (++AutoComplete.idCount)
        this.handleClickOutside()

        if (this.suggestor && this.preload)
            await this.suggestor("")                           
        if (this._fromModel)
            this.setSelection (this._fromModel())
    }
    
    /**
     * You can pass additional properties to the outer div.
     * To customise inner element styles, use css nesting:
     *    "input" for search text box
     *    ".selection" for a selection when isMultiSelect is true
     *    ".dropdown-menu", ".dropdown-item", for suggestions (i.e. the bootstrap classes)
     * e.g. { style: { $nest: {".selection": { backgroundColor: "yellow" } } } }
     */
    view (props?: HProps) {  
        return div ({ class: "autocomplete " + css.outer + " d-flex align-items-center flex-wrap"}, props,
            this.selectionsView(),
            this.searchTextView (),
            this.suggestionsView ()
        )
    }

    private searchTextView () {
        return (
            inputText (
                () => this.searchText,
                e => this.searchTextChange (e),
                {
                    id : this.id,
                    autocomplete: "off",
                    class: css.input,
                    onfocus: () => { $("#"+this.id).parent().addClass ([css.focus, "focus"]) },
                    onblur: () => { $("#"+this.id).parent().removeClass ([css.focus, "focus"]) },
                    onkeyup: (e: KeyboardEvent) => {
                        if (e.keyCode === 27) // ESC
                            this.closeSuggestions()
                        if (e.keyCode == 13) { // ENTER    
                            if (this.allowNonSuggestions && ! isNullOrEmpty (this.searchText) && ! this.suggestions.length)
                                this.selectNonSuggestion()
                            else if (this.enterKeySelection)
                                this.enterKeySelection = false
                            else
                                this.autocomplete()
                        }
                        else if (e.keyCode == 40 && this.suggestions.length) { // DOWN
                            $(".dropdown-item").first().focus()
                        }
                    },
                    onkeydown: (e: KeyboardEvent) => {
                        if (e.keyCode == 8 && isNullOrEmpty (this.searchText)) { // delete 
                            console.log("delete")
                            if (this.selections.length)
                                this.removeSelection (this.selections[this.selections.length-1])
                        }
                    }  
                }
            )
        )
    }

    private selectNonSuggestion() {
        this.update (() => {            
            this.selections = this.selections.concat (this.searchText!)
            this.searchText = ""
            this.onSelect()
            this.focusSearchTextBox()
        })
    }

    private searchTextChange(payload: KeyValue) {         
        if (this.searchText == payload.value)
            return
        this.update(() => {            
            const match = this.suggestions.filter (s => s.toLowerCase() == (this.searchText || "").toLowerCase())
            this.isSuggestion = match.length > 0
            this.updateProperty (payload)
            if (isNullOrEmpty (payload.value))
                this.attemptedAutoComplete = false
            if (this.isSuggestion) {
                this.searchText = match[0]
                this.onSelect()
            }
        })
        if (this.isRealtime)
            this.autocompleteAsync ()    
    }
    
    @debounce (300)    
    private autocompleteAsync () {
        this.autocomplete()
    }

    async autocomplete () {
        if (! this.suggestor)
            return
      
        const search = this.searchText

        if (isNullOrEmpty(search)) {
            this.suggestions = []
            this.update (() => {
                this.attemptedAutoComplete = false
            })
            return
        }
        var suggestions = await this.suggestor (search!)
        
        this.update(() =>
        {            
            if (this.autoFilter) {
                const reg = new RegExp (search!, "i")
                suggestions = suggestions.filter (s => reg.test (s) && this.selections.indexOf (s) == -1)
            }
            
            if (this.autoSelectSingleResult && suggestions.length == 1) {
                this.selectSuggestion (suggestions[0])
                $("#"+this.id).val (this.searchText || "") // hack
                return
            }

            this.suggestions = suggestions.slice (0, this.suggestionLimit)              
            this.attemptedAutoComplete = true
        })
    }

    private selectionsView () {
        return (
            ! this.selections.length ? undefined :            
                this.selections.map (sel =>
                    span ({class: css.selection + " selection d-flex align-items-center "},
                        span ({style: {whiteSpace: "nowrap" }}, sel),
                        commandButton(
                            () => this.removeSelection (sel),
                            { class: 'close d-inline-flex', type: 'button' }, icon ({ style: { fontSize: "16px", fontWeight: "bold" } }, "close")
                        )
                    )
                )            
        )
    }

    protected onSelect()
    {  
        const selection =
            this.isMultiSelect ?
                this.selections :
                this.isSuggestion || this.looseMatch ? (this.searchText || "") : ""

        if (this.onSelectEvent)
            this.onSelectEvent (selection)

        if (this._toModel)
            this._toModel (selection)
    }

    private removeSelection (sel: string) {
        this.update (() => {
            this.selections = this.selections.filter (s => s != sel)
            this.onSelect()
            this.focusSearchTextBox()
        })
    }

    private focusSearchTextBox() {
        this.onRefreshed(() => $("#" + this.id).focus())
    }

    private closeSuggestions () {
        this.update(() => {
            this.suggestions = []
            this.isSuggestion = false
            this.attemptedAutoComplete = false
            this.focusSearchTextBox()
        })
    }

    private suggestionKeyDown (e: KeyboardEvent)
    {        
        if (e.keyCode == 27) // ESCAPE
            this.closeSuggestions()
        else if (e.keyCode == 13) // ENTER
            this.enterKeySelection = true                    
        else {
            this.transitioningFocus = true
            if (e.keyCode == 38 && e.srcElement!.previousElementSibling)
                (e.srcElement!.previousElementSibling as any).focus()
            else if (e.keyCode == 40 && e.srcElement!.nextElementSibling)
                (e.srcElement!.nextElementSibling as any).focus()
        }
    }

    isSuggestionsVisible() {
        return this.attemptedAutoComplete && (this.showNoResultsFound || this.suggestions.length)
    }

    private suggestionsView () {
        return (           
            ! this.isSuggestionsVisible() ? undefined :
            div ({ class:'dropdown-menu', style: { overflowY: "auto", maxHeight: "300px", display: 'block', fontSize: this.suggestionLimit <= 10 ? undefined : '80% '} },
                this.suggestions.length == 0 ?
                    div ({ class: 'text-center'}, "No results found") :
                this.suggestions.map ((s, index) =>
                    commandLink (() => this.selectSuggestion (s),
                        {
                            tabindex: 0,
                            onkeydown: (e: KeyboardEvent) => {this.suggestionKeyDown (e)},
                            class: 'dropdown-item'
                        }, s)
                )
            )
        )
    }

    private selectSuggestion (suggestion: string) {  
        this.update(() => {
            this.searchText = this.isMultiSelect ? "" : suggestion            
            this.selections = this.isMultiSelect ? this.selections.concat (suggestion) : []
            this.suggestions = []
            this.isSuggestion = true
            this.attemptedAutoComplete = false
            this.focusSearchTextBox()
            this.onSelect()
        })
    }

    setSelection (selection: string | string[])
    {
        this.update (() => {
            if (this.isMultiSelect)
                this.selections = <string[]> selection
            else {
                this.searchText = <string> selection
                this.isSuggestion = true
            }
        })
    }
}

export const mapSingleOrMultiple = <T,U> (isMulti: boolean, value: T | T[], mapping: (val: T) => U) =>
    isMulti ?
        (<T[]>value).map (x => mapping (x)) :
        mapping (<T>value)

export const css = {
    outer: style({           
        border: "1px solid #ced4da",
        borderRadius: "0.25rem",    
        padding: "0.2rem",
        backgroundColor: "white",
        height: "auto",
        minHeight: "calc(2.25rem + 2px)"
    }),
    input: style({
        border: "none",
        maxWidth: "99%",    
        flex: "1 1 auto",
        height: "auto",    
        margin: "0 0.25rem",       
        $nest: {
            "&:focus": {
                boxShadow: "none",  
                border: "none !important",
                outlineColor: "white"
            }
        }
    }),
    focus: style ({
        $debugName: "psuedo-focus",
        borderColor: "#80bdff",
        outline: 0,
        boxShadow: "0 0 0 0.2rem rgba(0, 123, 255, 0.25)"                
    }),
    selection: style ({
        border: "1px solid #bec4ca",
        borderRadius: "0.25rem",
        backgroundColor: "rgba(0, 123, 255, 0.25)",
        margin: "0.2rem",    
        padding: "0 0.25rem",
        height: "1.5rem",
        fontSize: "90%"
    })
}

export const mapPropertyFromTo = <T> (
    array: T[],
    from: (value: T) => string,
    to: (value: T) => string
    ) =>
    (value: string) =>
        Let (array.find (c => from(c) == value), c => c ? to(c) : "")
