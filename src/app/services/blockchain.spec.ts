import { TestBed } from '@angular/core/testing';
import { BlockchainService } from './blockchain'; // Import du nom exact de la classe

describe('BlockchainService', () => {
  let service: BlockchainService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BlockchainService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});