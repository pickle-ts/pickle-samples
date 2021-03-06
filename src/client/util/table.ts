import { debounce } from 'lodash-decorators'
import { orderBy } from 'lodash-es'
import { commandLink, Component, transient, div, equalsIgnoreCase, getFriendlyName, HValue, inputText, isNullOrEmpty, key, table, tbody, td, th, thead, tr, VElement } from "solenya"
import { MenuItem, menuView } from './bsmenu'
import { objUrl, queryToObject } from './network'

export interface Column<T> {
    property: (() => any) | string,
    label?: string,
    display?: (row: T) => HValue,
    options?: FieldOption[],
    canSort?: boolean
}

export interface ITableQuery
{
    from: number
    pageSize: number
    search?: string
    sort?: string
}

export interface FieldOption
{
    value: string
    label: string
}

type SortValue =
{
    key: string
    ascending: boolean
}

type TableViewProps<T> =
{
    css?: string
    columns: Column<T>[]
    guideObject: T
}

export abstract class Table<T> extends Component implements ITableQuery
{       
    abstract results?: T[]

    from = 0
    pageSize = 10        
    sort = ""
    total = NaN
    @transient _search = ""

    constructor (pageSize?: number) {
        super()
        if (pageSize)
            this.pageSize = pageSize
    }

    abstract reload() : Promise<void>   

    @transient
    get search() {return this._search}

    set search (value: string) {
        if (value || "" != this._search || "") {
            this._search = value
            this.doSearch()
        }
    }

    @transient
    get hasMoreResults() {
        return this.from + this.pageSize <= this.total
    }

    sortValues() : SortValue[] {
        return decodeSortValues (this.sort)
    }

    async loadFromUrl (tableUrl: string)
    {
        const newTable = <this> await queryToObject (<any>this.constructor, objUrl (tableUrl, this.getQuery()))        
        
        if (newTable)
            this.update (() => {
                this.results = newTable.results        
                this.from = newTable.from
                this.pageSize = newTable.pageSize
                this.total = newTable.total        
            })

        return newTable != null
    }

    loadFromArray (rows: T[], filter: (row: T) => boolean)
    {
        if (this.search && this.search != "")        
            rows = rows.filter (filter)
     
        const sortValues = this.sortValues()
        if (sortValues.length)
            rows = orderBy (rows, sortValues[0].key, sortValues[0].ascending ? undefined : "desc")        
        
        this.update (() => {            
            this.results = rows.slice (this.from, this.from + this.pageSize)             
            this.total = rows.length
        })
    }

    protected canPrev() {
        return this.from > 0
    }

    protected canNext() {
        return this.hasMoreResults
    }

    protected prev() {
        this.from = Math.max (0, this.from - this.pageSize)
        this.reload()
    }

    protected next() {
        this.from = this.from + this.pageSize
        this.reload()
    }

    getQuery() : ITableQuery {
        return {
            from: this.from,
            pageSize: this.pageSize,
            search: this.search,
            sort: this.sort
        }
    }

    @debounce (300)   
    private doSearch () {        
        this.from = 0
        this.reload()
    }

    doSort (key: string, direction: boolean)
    {
        this.sort = encodeSortValues ([{key: key, ascending: direction}])
        this.reload()
    }
    
    view (props?: TableViewProps<T>) {   
        return (
            div (
                ! this.results || ! props ? undefined : 
                div (
                    this.content (props),
                    this.pager()
                )
            )
        )
    }

    content (props: TableViewProps<T>): VElement {        
        return div (
            table ({class: props.css},
                thead (
                    props.columns.map (col => th (this.columnHeader (col, props.guideObject)))
                ),
                tbody (
                    this.results!.map (row =>
                        tr (
                            props.columns.map (col =>
                                td (
                                    ! col.display ?                                                                                
                                        row[typeof(col.property) == "string" ? col.property : key (col.property)] :
                                        col.display (row)
                                )
                            )
                        )
                    )
                )
            )
        )
    }    

    protected pager() {
        return (
            div ({class: 'row', style: {margin: '1rem -0.5rem'}},
                [                
                    ! this.canPrev() ? null : commandLink ({ onclick: () => this.prev() }, "Previous"),
                    ! this.results!.length ? "No results." : `${this.from + 1} to ${this.from + this.results!.length} of ${this.total}`,
                    ! this.canNext() ? null : commandLink ({ onclick: () => this.next() }, "Next")                    
                ]
                .filter (x => x != null)
                .map (x => div ({class: 'mx-2 d-flex align-items-center'}, x))
            )
        )
    }       

    columnHeader (col: Column<T>, guideObject?: T)
    {
        const property = typeof(col.property) == "string" ? col.property : key (col.property)        
        const lbl = col.label || getFriendlyName (guideObject, col.property)

        if (! col.canSort && ! col.options)
            return lbl
        
        const search = this.search

        return menuView (lbl,
            ! col.options ? false : col.options.filter (x => equalsIgnoreCase (search, x.value)).length > 0,
            ...this.sortMenu (col),                
            ...(
                ! col.options || ! col.options.length ? [] :
                [
                    ...col.canSort ? [{ label: "" }] : [],
                    ...col.options.map (o => <MenuItem>
                    {
                        label: o.label + (equalsIgnoreCase (search, o.value) ? " ✓" : ""),
                        action: () => {
                            this.search = o.value
                        }
                    })
                ]
            ),
            ... (
                isNullOrEmpty (search) ? [] :
                [
                    { label: ""},
                    <MenuItem> { label: "Clear Filter", action: () => { this.search = ""} }
                ]
            )
        )        
    }

    protected sortMenu(col: Column<T>) {
        const property = typeof(col.property) == "string" ? col.property : key (col.property)    
        return ! col.canSort ? [] :
        [
            { label: "Sort Ascending" + this.tick (property, true), action: () => this.doSort (property, true)},
            { label: "Sort Descending" + this.tick (property, false), action: () => this.doSort (property, false)}
        ]
    }

    protected tick (property: string, ascending: boolean) {
        if (! this.sortValues().length)
            return ""
        const sort = this.sortValues()[0]
        return sort.key == property && ascending == sort.ascending ? " ✓" : ""
    }

    searchInput() {
        return (            
            div ({ class: "d-flex align-items-center" },
                inputText ({ target: this, prop: () => this.search, attrs: {                   
                    placeholder: "Search",
                    class: 'form-control',
                    style: { width: "300px"}
                }}),
                isNullOrEmpty (this.search) ? undefined :
                    commandLink ({ onclick: () => { this.search = "" }, class: "ml-2"}, "Clear")
            )
        )
    }
}

function encodeSortValues (values: SortValue[])
{
    return values.map (v => v.key + (v.ascending ? "" : " desc") ).join (",")
}

function decodeSortValues (sort: string)
{
    if (isNullOrEmpty (sort))
        return []
    
    const values = sort.split (",")
    return <SortValue[]> values.map (v =>
        {
            const parts = v.split (" ")
            if (! parts.length)
                return undefined    
            return <SortValue>{ key: parts[0], ascending: parts.length < 2 || parts[1] != "desc" }
        })
        .filter(v => v != null)
}