import { IsIn, IsString, Length } from 'class-validator';
export class CreateStudyRoomDto { @IsString() @Length(1, 120) name!: string; @IsIn(['public', 'private']) visibility!: 'public' | 'private'; }
