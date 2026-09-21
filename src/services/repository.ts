/** Local repository seam — Supabase implementations can conform to these methods later. */
export interface Repository<T extends {id:string}>{list():Promise<T[]>;save(item:T):Promise<void>}
